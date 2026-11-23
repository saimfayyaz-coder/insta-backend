import mongoose from "mongoose";
import Post from "../models/Post.js";
import Media from "../models/Media.js";
import User from "../models/User.js";
import Follow from "../models/Follow.js";
import ApiResponse from "../utils/ApiResponse.js";
import { ErrorCodes } from "../utils/ErrorCodes.js";
import { MEDIA_STATUS, POST_ASPECT_RATIOS, POST_LIMITS } from "../utils/postLimits.js";
import { parseCaption } from "../utils/caption.js";
import { formatPostResponse } from "../utils/postFormatter.js";
import { afterCursor, decodeCursor, encodeCursor } from "../utils/cursor.js";
import { deleteManyFromCloudinary } from "../services/media.service.js";

const HOUR_MS = 60 * 60 * 1000;
const DUPLICATE_KEY_ERROR = 11000;
const AUTHOR_FIELDS = "username avatar";

const fail = (res, status, message, code) =>
  res.status(status).json(new ApiResponse(false, message, null, null, code));

const isObjectId = (value) => mongoose.isValidObjectId(value);

const pageLimit = (value) =>
  Math.min(Math.max(parseInt(value, 10) || POST_LIMITS.PAGE_SIZE, 1), POST_LIMITS.MAX_PAGE_SIZE);

const sendPost = (res, status, message, post, author) =>
  res.status(status).json(new ApiResponse(true, message, { post: formatPostResponse(post, author) }));

const validateCreateBody = (body) => {
  const { mediaIds, aspectRatio, caption = "", location = "", altTexts = [] } = body;

  if (!Array.isArray(mediaIds) || mediaIds.length === 0) {
    return ErrorCodes.POST_MEDIA_REQUIRED;
  }
  if (mediaIds.length > POST_LIMITS.MAX_MEDIA) {
    return ErrorCodes.POST_TOO_MANY_MEDIA;
  }
  if (!mediaIds.every(isObjectId) || new Set(mediaIds).size !== mediaIds.length) {
    return ErrorCodes.MEDIA_NOT_FOUND;
  }
  if (!Object.values(POST_ASPECT_RATIOS).includes(Number(aspectRatio))) {
    return ErrorCodes.INVALID_ASPECT_RATIO;
  }
  if (typeof caption !== "string" || caption.length > POST_LIMITS.CAPTION_MAX_LENGTH) {
    return ErrorCodes.CAPTION_TOO_LONG;
  }

  const { hashtags, mentions } = parseCaption(caption);
  if (hashtags.length > POST_LIMITS.MAX_HASHTAGS) return ErrorCodes.TOO_MANY_HASHTAGS;
  if (mentions.length > POST_LIMITS.MAX_MENTIONS) return ErrorCodes.TOO_MANY_MENTIONS;

  if (
    typeof location !== "string" ||
    location.length > POST_LIMITS.LOCATION_MAX_LENGTH ||
    !Array.isArray(altTexts) ||
    altTexts.some(
      (text) => typeof text !== "string" || text.length > POST_LIMITS.ALT_TEXT_MAX_LENGTH,
    )
  ) {
    return ErrorCodes.VALIDATION_FAILED;
  }

  return null;
};

export const createPost = async (req, res) => {
  try {
    const errorCode = validateCreateBody(req.body);
    if (errorCode) {
      return fail(res, 400, "Invalid post", errorCode);
    }

    const { mediaIds, caption = "", location = "", altTexts = [] } = req.body;
    const aspectRatio = Number(req.body.aspectRatio);
    const clientRequestId =
      typeof req.body.clientRequestId === "string" ? req.body.clientRequestId.slice(0, 64) : null;

    // A retry after a lost response gets the post that was already made
    if (clientRequestId) {
      const existing = await Post.findOne({ author: req.user._id, clientRequestId });
      if (existing) {
        return sendPost(res, 200, "Post already created", existing, req.user);
      }
    }

    const recentPosts = await Post.countDocuments({
      author: req.user._id,
      createdAt: { $gt: new Date(Date.now() - HOUR_MS) },
    });
    if (recentPosts >= POST_LIMITS.MAX_POSTS_PER_HOUR) {
      return fail(res, 429, "Too many posts, try again later", ErrorCodes.RATE_LIMITED);
    }

    const mediaDocs = await Media.find({
      _id: { $in: mediaIds },
      owner: req.user._id,
      status: MEDIA_STATUS.PENDING,
    });
    if (mediaDocs.length !== mediaIds.length) {
      return fail(res, 400, "Some images are missing or already used", ErrorCodes.MEDIA_NOT_FOUND);
    }
    if (mediaDocs.some((item) => item.aspectRatio !== aspectRatio)) {
      return fail(res, 400, "Images do not match the post shape", ErrorCodes.INVALID_ASPECT_RATIO);
    }

    const mediaById = new Map(mediaDocs.map((item) => [item._id.toString(), item]));
    const { hashtags, mentions } = parseCaption(caption);

    let post;
    try {
      post = await Post.create({
        author: req.user._id,
        media: mediaIds.map((id, index) => {
          const item = mediaById.get(id);
          return {
            media: item._id,
            url: item.url,
            publicId: item.publicId,
            thumbUrl: item.thumbUrl,
            thumbPublicId: item.thumbPublicId,
            width: item.width,
            height: item.height,
            altText: (altTexts[index] || "").trim(),
          };
        }),
        aspectRatio,
        caption: caption.trim(),
        hashtags,
        mentions,
        location: location.trim(),
        clientRequestId,
      });
    } catch (error) {
      // Two identical requests raced; return the one that won
      if (error.code === DUPLICATE_KEY_ERROR && clientRequestId) {
        const existing = await Post.findOne({ author: req.user._id, clientRequestId });
        if (existing) return sendPost(res, 200, "Post already created", existing, req.user);
      }
      throw error;
    }

    await Media.updateMany(
      { _id: { $in: mediaIds } },
      { $set: { status: MEDIA_STATUS.ATTACHED } },
    );
    await User.updateOne({ _id: req.user._id }, { $inc: { postsCount: 1 } });

    return sendPost(res, 201, "Post created", post, req.user);
  } catch (error) {
    console.error("Create post error:", error);
    return fail(res, 500, "Failed to create post", ErrorCodes.SERVER_ERROR);
  }
};

export const getUserPosts = async (req, res) => {
  try {
    const { userId } = req.params;
    if (!isObjectId(userId)) {
      return fail(res, 404, "User not found", ErrorCodes.USER_NOT_FOUND);
    }

    const author = await User.findById(userId).select(AUTHOR_FIELDS);
    if (!author) {
      return fail(res, 404, "User not found", ErrorCodes.USER_NOT_FOUND);
    }

    const limit = pageLimit(req.query.limit);

    const filter = { author: author._id };
    if (req.query.cursor) {
      const cursor = decodeCursor(req.query.cursor);
      if (!cursor) {
        return fail(res, 400, "Invalid cursor", ErrorCodes.VALIDATION_FAILED);
      }
      Object.assign(filter, afterCursor(cursor));
    }

    // One extra tells whether another page exists
    const posts = await Post.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit + 1);

    const hasMore = posts.length > limit;
    const page = hasMore ? posts.slice(0, limit) : posts;

    return res.status(200).json(
      new ApiResponse(true, "Posts fetched", {
        posts: page.map((post) => formatPostResponse(post, author)),
        nextCursor: hasMore ? encodeCursor(page[page.length - 1]) : null,
      }),
    );
  } catch (error) {
    console.error("Get user posts error:", error);
    return fail(res, 500, "Failed to fetch posts", ErrorCodes.SERVER_ERROR);
  }
};

// Posts from the people the user follows plus their own, newest first
export const getFeed = async (req, res) => {
  try {
    const limit = pageLimit(req.query.limit);
    const followingIds = await Follow.find({ follower: req.user._id }).distinct("following");

    const filter = { author: { $in: [...followingIds, req.user._id] } };
    if (req.query.cursor) {
      const cursor = decodeCursor(req.query.cursor);
      if (!cursor) {
        return fail(res, 400, "Invalid cursor", ErrorCodes.VALIDATION_FAILED);
      }
      Object.assign(filter, afterCursor(cursor));
    }

    // One extra tells whether another page exists
    const posts = await Post.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit + 1)
      .populate("author", AUTHOR_FIELDS);

    const hasMore = posts.length > limit;
    const page = hasMore ? posts.slice(0, limit) : posts;

    return res.status(200).json(
      new ApiResponse(true, "Feed fetched", {
        // Posts whose author account is gone are skipped
        posts: page.filter((post) => post.author).map((post) => formatPostResponse(post)),
        nextCursor: hasMore ? encodeCursor(page[page.length - 1]) : null,
      }),
    );
  } catch (error) {
    console.error("Get feed error:", error);
    return fail(res, 500, "Failed to fetch feed", ErrorCodes.SERVER_ERROR);
  }
};

export const getPost = async (req, res) => {
  try {
    const { postId } = req.params;
    if (!isObjectId(postId)) {
      return fail(res, 404, "Post not found", ErrorCodes.POST_NOT_FOUND);
    }

    const post = await Post.findById(postId).populate("author", AUTHOR_FIELDS);
    if (!post || !post.author) {
      return fail(res, 404, "Post not found", ErrorCodes.POST_NOT_FOUND);
    }

    return sendPost(res, 200, "Post fetched", post);
  } catch (error) {
    console.error("Get post error:", error);
    return fail(res, 500, "Failed to fetch post", ErrorCodes.SERVER_ERROR);
  }
};

export const deletePost = async (req, res) => {
  try {
    const { postId } = req.params;
    if (!isObjectId(postId)) {
      return fail(res, 404, "Post not found", ErrorCodes.POST_NOT_FOUND);
    }

    const post = await Post.findById(postId);
    if (!post) {
      return fail(res, 404, "Post not found", ErrorCodes.POST_NOT_FOUND);
    }
    if (!post.author.equals(req.user._id)) {
      return fail(res, 403, "You can only delete your own posts", ErrorCodes.FORBIDDEN);
    }

    // Database first so the post disappears even if image cleanup fails
    const { deletedCount } = await Post.deleteOne({ _id: post._id });
    if (deletedCount === 1) {
      await User.updateOne(
        { _id: req.user._id, postsCount: { $gt: 0 } },
        { $inc: { postsCount: -1 } },
      );
      await Media.deleteMany({ _id: { $in: post.media.map((item) => item.media) } });
      await deleteManyFromCloudinary(
        post.media.flatMap((item) => [item.publicId, item.thumbPublicId]),
      );
    }

    return res.status(200).json(new ApiResponse(true, "Post deleted", { postId }));
  } catch (error) {
    console.error("Delete post error:", error);
    return fail(res, 500, "Failed to delete post", ErrorCodes.SERVER_ERROR);
  }
};
