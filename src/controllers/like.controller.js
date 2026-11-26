import mongoose from "mongoose";
import Post from "../models/Post.js";
import PostLike from "../models/PostLike.js";
import ApiResponse from "../utils/ApiResponse.js";
import { ErrorCodes } from "../utils/ErrorCodes.js";
import { LIKE_LIMITS } from "../utils/likeLimits.js";
import { visibleLikeCount } from "../utils/postFormatter.js";
import { afterCursor, decodeCursor, encodeCursor } from "../utils/cursor.js";
import { USER_SUMMARY_FIELDS, formatUserSummary } from "../utils/userFormatter.js";
import { getFollowedIds } from "../services/follow.service.js";
import { isLikeToggleRateLimited, notifyPostLiked } from "../services/like.service.js";

const DUPLICATE_KEY_ERROR = 11000;
const POST_FIELDS = "author likeCount hideLikeCount";

const fail = (res, status, message, code) =>
  res.status(status).json(new ApiResponse(false, message, null, null, code));

// A post whose author account is gone counts as missing
const findPost = async (postId) => {
  if (!mongoose.isValidObjectId(postId)) return null;
  const post = await Post.findById(postId).select(POST_FIELDS).populate("author", "_id");
  return post?.author ? post : null;
};

// updated is the post after the count changed, when it did
const sendLikeState = (res, message, { post, updated, viewerId, isLiked }) =>
  res.status(200).json(
    new ApiResponse(true, message, {
      postId: post._id.toString(),
      isLiked,
      likeCount: visibleLikeCount(
        { author: post.author, hideLikeCount: post.hideLikeCount, likeCount: (updated || post).likeCount },
        viewerId,
      ),
    }),
  );

// Checks shared by like and unlike; sends the error and returns null when one fails
const loadPostForToggle = async (req, res) => {
  if (isLikeToggleRateLimited(req.user._id)) {
    fail(res, 429, "Too many likes, try again later", ErrorCodes.RATE_LIMITED);
    return null;
  }
  const post = await findPost(req.params.postId);
  if (!post) {
    fail(res, 404, "Post not found", ErrorCodes.POST_NOT_FOUND);
    return null;
  }
  return post;
};

// Liking a post you already like just returns the current state
export const likePost = async (req, res) => {
  try {
    const post = await loadPostForToggle(req, res);
    if (!post) return undefined;

    try {
      await PostLike.create({ post: post._id, user: req.user._id });
    } catch (error) {
      if (error.code === DUPLICATE_KEY_ERROR) {
        return sendLikeState(res, "Already liked", {
          post,
          viewerId: req.user._id,
          isLiked: true,
        });
      }
      throw error;
    }

    const updated = await Post.findByIdAndUpdate(
      post._id,
      { $inc: { likeCount: 1 } },
      { returnDocument: "after", projection: POST_FIELDS },
    );

    // The like is saved; a failed push must not fail the request
    notifyPostLiked({ post, liker: req.user }).catch((error) =>
      console.error("Like notification error:", error),
    );

    return sendLikeState(res, "Liked", { post, updated, viewerId: req.user._id, isLiked: true });
  } catch (error) {
    console.error("Like post error:", error);
    return fail(res, 500, "Failed to like post", ErrorCodes.SERVER_ERROR);
  }
};

// Unliking a post you don't like just returns the current state
export const unlikePost = async (req, res) => {
  try {
    const post = await loadPostForToggle(req, res);
    if (!post) return undefined;

    const { deletedCount } = await PostLike.deleteOne({ post: post._id, user: req.user._id });
    if (deletedCount === 0) {
      return sendLikeState(res, "Not liked", { post, viewerId: req.user._id, isLiked: false });
    }

    // The guard keeps the count from going below zero if it ever drifted
    const updated = await Post.findOneAndUpdate(
      { _id: post._id, likeCount: { $gt: 0 } },
      { $inc: { likeCount: -1 } },
      { returnDocument: "after", projection: POST_FIELDS },
    );

    return sendLikeState(res, "Unliked", { post, updated, viewerId: req.user._id, isLiked: false });
  } catch (error) {
    console.error("Unlike post error:", error);
    return fail(res, 500, "Failed to unlike post", ErrorCodes.SERVER_ERROR);
  }
};

// People who liked a post, newest first, each with the viewer's follow state
export const getPostLikers = async (req, res) => {
  try {
    const post = await findPost(req.params.postId);
    if (!post) {
      return fail(res, 404, "Post not found", ErrorCodes.POST_NOT_FOUND);
    }

    const limit = Math.min(
      Math.max(parseInt(req.query.limit, 10) || LIKE_LIMITS.PAGE_SIZE, 1),
      LIKE_LIMITS.MAX_PAGE_SIZE,
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
    const likes = await PostLike.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit + 1)
      .populate("user", USER_SUMMARY_FIELDS);

    const hasMore = likes.length > limit;
    const page = hasMore ? likes.slice(0, limit) : likes;
    // Likes from deleted accounts are skipped
    const users = page.map((like) => like.user).filter(Boolean);
    const followedIds = await getFollowedIds(
      req.user._id,
      users.map((user) => user._id),
    );

    return res.status(200).json(
      new ApiResponse(true, "Likers fetched", {
        users: users.map((user) => formatUserSummary(user, followedIds.has(user._id.toString()))),
        nextCursor: hasMore ? encodeCursor(page[page.length - 1]) : null,
      }),
    );
  } catch (error) {
    console.error("Get post likers error:", error);
    return fail(res, 500, "Failed to fetch likes", ErrorCodes.SERVER_ERROR);
  }
};

