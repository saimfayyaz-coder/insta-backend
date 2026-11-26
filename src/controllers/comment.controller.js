import mongoose from "mongoose";
import Post from "../models/Post.js";
import Comment from "../models/Comment.js";
import ApiResponse from "../utils/ApiResponse.js";
import { ErrorCodes } from "../utils/ErrorCodes.js";
import { COMMENT_LIMITS } from "../utils/commentLimits.js";
import { parseCaption } from "../utils/caption.js";
import { formatCommentResponse } from "../utils/commentFormatter.js";
import { afterCursor, decodeCursor, encodeCursor } from "../utils/cursor.js";
import { USER_SUMMARY_FIELDS } from "../utils/userFormatter.js";
import {
  deleteCommentNotification,
  isCommentRateLimited,
  notifyPostCommented,
} from "../services/comment.service.js";

const DUPLICATE_KEY_ERROR = 11000;
const POST_FIELDS = "author commentCount commentsDisabled";

const fail = (res, status, message, code) =>
  res.status(status).json(new ApiResponse(false, message, null, null, code));

// A post whose author account is gone counts as missing
const findPost = async (postId) => {
  if (!mongoose.isValidObjectId(postId)) return null;
  const post = await Post.findById(postId).select(POST_FIELDS).populate("author", "_id");
  return post?.author ? post : null;
};

const sendCreatedComment = (res, status, message, { comment, post, author, viewerId, commentCount }) =>
  res.status(status).json(
    new ApiResponse(true, message, {
      comment: formatCommentResponse(comment, {
        author,
        postAuthorId: post.author._id,
        viewerId,
      }),
      commentCount,
    }),
  );

// Comments on a post, newest first
export const getPostComments = async (req, res) => {
  try {
    const post = await findPost(req.params.postId);
    if (!post) {
      return fail(res, 404, "Post not found", ErrorCodes.POST_NOT_FOUND);
    }

    const limit = Math.min(
      Math.max(parseInt(req.query.limit, 10) || COMMENT_LIMITS.PAGE_SIZE, 1),
      COMMENT_LIMITS.MAX_PAGE_SIZE,
    );

    const filter = { post: post._id };
    if (req.query.cursor) {
      const cursor = decodeCursor(req.query.cursor);
      if (!cursor) {
        return fail(res, 400, "Invalid cursor", ErrorCodes.VALIDATION_FAILED);
      }
      Object.assign(filter, afterCursor(cursor));
    }

    // One extra tells whether another page exists
    const comments = await Comment.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit + 1)
      .populate("author", USER_SUMMARY_FIELDS);

    const hasMore = comments.length > limit;
    const page = hasMore ? comments.slice(0, limit) : comments;

    return res.status(200).json(
      new ApiResponse(true, "Comments fetched", {
        // Comments from deleted accounts are skipped
        comments: page
          .filter((comment) => comment.author)
          .map((comment) =>
            formatCommentResponse(comment, {
              postAuthorId: post.author._id,
              viewerId: req.user._id,
            }),
          ),
        nextCursor: hasMore ? encodeCursor(page[page.length - 1]) : null,
        commentCount: post.commentCount,
        commentsDisabled: post.commentsDisabled,
      }),
    );
  } catch (error) {
    console.error("Get post comments error:", error);
    return fail(res, 500, "Failed to fetch comments", ErrorCodes.SERVER_ERROR);
  }
};

export const createComment = async (req, res) => {
  try {
    if (isCommentRateLimited(req.user._id)) {
      return fail(res, 429, "Too many comments, try again later", ErrorCodes.RATE_LIMITED);
    }

    const post = await findPost(req.params.postId);
    if (!post) {
      return fail(res, 404, "Post not found", ErrorCodes.POST_NOT_FOUND);
    }
    if (post.commentsDisabled) {
      return fail(res, 403, "Comments are disabled for this post", ErrorCodes.COMMENTS_DISABLED);
    }

    const text = typeof req.body?.text === "string" ? req.body.text.trim() : "";
    if (!text) {
      return fail(res, 400, "Comment text is required", ErrorCodes.COMMENT_REQUIRED);
    }
    if (text.length > COMMENT_LIMITS.MAX_LENGTH) {
      return fail(res, 400, "Comment is too long", ErrorCodes.COMMENT_TOO_LONG);
    }

    const { mentions } = parseCaption(text);
    if (mentions.length > COMMENT_LIMITS.MAX_MENTIONS) {
      return fail(res, 400, "Too many mentions", ErrorCodes.TOO_MANY_MENTIONS);
    }

    const clientRequestId =
      typeof req.body?.clientRequestId === "string"
        ? req.body.clientRequestId.trim().slice(0, COMMENT_LIMITS.CLIENT_REQUEST_ID_MAX_LENGTH) || null
        : null;

    // A retry after a lost response gets the comment that was already created
    if (clientRequestId) {
      const existing = await Comment.findOne({
        post: post._id,
        author: req.user._id,
        clientRequestId,
      });
      if (existing) {
        return sendCreatedComment(res, 200, "Comment already added", {
          comment: existing,
          post,
          author: req.user,
          viewerId: req.user._id,
          commentCount: post.commentCount,
        });
      }
    }

    let comment;
    try {
      comment = await Comment.create({
        post: post._id,
        author: req.user._id,
        text,
        mentions,
        clientRequestId,
      });
    } catch (error) {
      if (error.code === DUPLICATE_KEY_ERROR && clientRequestId) {
        const existing = await Comment.findOne({
          post: post._id,
          author: req.user._id,
          clientRequestId,
        });
        if (existing) {
          return sendCreatedComment(res, 200, "Comment already added", {
            comment: existing,
            post,
            author: req.user,
            viewerId: req.user._id,
            commentCount: post.commentCount,
          });
        }
      }
      throw error;
    }

    const updated = await Post.findByIdAndUpdate(
      post._id,
      { $inc: { commentCount: 1 } },
      { returnDocument: "after", projection: POST_FIELDS },
    );

    // The comment is saved; a failed push must not fail the request
    notifyPostCommented({ post, comment, commenter: req.user }).catch((error) =>
      console.error("Comment notification error:", error),
    );

    return sendCreatedComment(res, 201, "Comment added", {
      comment,
      post,
      author: req.user,
      viewerId: req.user._id,
      commentCount: updated?.commentCount ?? post.commentCount + 1,
    });
  } catch (error) {
    console.error("Create comment error:", error);
    return fail(res, 500, "Failed to add comment", ErrorCodes.SERVER_ERROR);
  }
};

export const deleteComment = async (req, res) => {
  try {
    const post = await findPost(req.params.postId);
    if (!post) {
      return fail(res, 404, "Post not found", ErrorCodes.POST_NOT_FOUND);
    }

    const { commentId } = req.params;
    if (!mongoose.isValidObjectId(commentId)) {
      return fail(res, 404, "Comment not found", ErrorCodes.COMMENT_NOT_FOUND);
    }

    const comment = await Comment.findOne({ _id: commentId, post: post._id }).select("author");
    if (!comment) {
      return fail(res, 404, "Comment not found", ErrorCodes.COMMENT_NOT_FOUND);
    }

    const isCommentAuthor = comment.author.equals(req.user._id);
    const isPostAuthor = post.author._id.equals(req.user._id);
    if (!isCommentAuthor && !isPostAuthor) {
      return fail(res, 403, "You cannot delete this comment", ErrorCodes.FORBIDDEN);
    }

    // Atomic delete avoids decrementing commentCount twice on racing requests
    const deleted = await Comment.findOneAndDelete({ _id: comment._id, post: post._id });
    if (!deleted) {
      return fail(res, 404, "Comment not found", ErrorCodes.COMMENT_NOT_FOUND);
    }

    // The guard keeps the count from going below zero if it ever drifted
    const updated = await Post.findOneAndUpdate(
      { _id: post._id, commentCount: { $gt: 0 } },
      { $inc: { commentCount: -1 } },
      { returnDocument: "after", projection: POST_FIELDS },
    );

    deleteCommentNotification(comment._id).catch((error) =>
      console.error("Delete comment notification error:", error),
    );

    return res.status(200).json(
      new ApiResponse(true, "Comment deleted", {
        commentId: comment._id.toString(),
        postId: post._id.toString(),
        commentCount: updated?.commentCount ?? 0,
      }),
    );
  } catch (error) {
    console.error("Delete comment error:", error);
    return fail(res, 500, "Failed to delete comment", ErrorCodes.SERVER_ERROR);
  }
};
