import mongoose from "mongoose";
import Follow from "../models/Follow.js";
import User from "../models/User.js";
import ApiResponse from "../utils/ApiResponse.js";
import { ErrorCodes } from "../utils/ErrorCodes.js";
import { FOLLOW_LIMITS } from "../utils/followLimits.js";
import { afterCursor, decodeCursor, encodeCursor } from "../utils/cursor.js";
import { USER_SUMMARY_FIELDS, formatUserSummary } from "../utils/userFormatter.js";
import { getFollowedIds } from "../services/follow.service.js";

const DUPLICATE_KEY_ERROR = 11000;

const fail = (res, status, message, code) =>
  res.status(status).json(new ApiResponse(false, message, null, null, code));

const findTarget = async (userId) =>
  mongoose.isValidObjectId(userId) ? User.findById(userId).select("followersCount") : null;

const sendFollowState = (res, message, target, isFollowing) =>
  res.status(200).json(
    new ApiResponse(true, message, {
      userId: target._id.toString(),
      isFollowing,
      followersCount: target.followersCount || 0,
    }),
  );

// Following someone you already follow just returns the current state
export const followUser = async (req, res) => {
  try {
    const { userId } = req.params;
    if (req.user._id.equals(userId)) {
      return fail(res, 400, "You can't follow yourself", ErrorCodes.CANNOT_FOLLOW_SELF);
    }

    const target = await findTarget(userId);
    if (!target) {
      return fail(res, 404, "User not found", ErrorCodes.USER_NOT_FOUND);
    }

    try {
      await Follow.create({ follower: req.user._id, following: target._id });
    } catch (error) {
      if (error.code === DUPLICATE_KEY_ERROR) {
        return sendFollowState(res, "Already following", target, true);
      }
      throw error;
    }

    const updated = await User.findByIdAndUpdate(
      target._id,
      { $inc: { followersCount: 1 } },
      { returnDocument: "after", projection: "followersCount" },
    );
    await User.updateOne({ _id: req.user._id }, { $inc: { followingCount: 1 } });

    return sendFollowState(res, "Followed", updated || target, true);
  } catch (error) {
    console.error("Follow error:", error);
    return fail(res, 500, "Failed to follow", ErrorCodes.SERVER_ERROR);
  }
};

// Unfollowing someone you don't follow just returns the current state
export const unfollowUser = async (req, res) => {
  try {
    const target = await findTarget(req.params.userId);
    if (!target) {
      return fail(res, 404, "User not found", ErrorCodes.USER_NOT_FOUND);
    }

    const { deletedCount } = await Follow.deleteOne({
      follower: req.user._id,
      following: target._id,
    });
    if (deletedCount === 0) {
      return sendFollowState(res, "Not following", target, false);
    }

    const updated = await User.findOneAndUpdate(
      { _id: target._id, followersCount: { $gt: 0 } },
      { $inc: { followersCount: -1 } },
      { returnDocument: "after", projection: "followersCount" },
    );
    await User.updateOne(
      { _id: req.user._id, followingCount: { $gt: 0 } },
      { $inc: { followingCount: -1 } },
    );

    return sendFollowState(res, "Unfollowed", updated || target, false);
  } catch (error) {
    console.error("Unfollow error:", error);
    return fail(res, 500, "Failed to unfollow", ErrorCodes.SERVER_ERROR);
  }
};

// Followers and following share this; `ownField` is the side matching the profile owner
const listFollows = (ownField, otherField) => async (req, res) => {
  try {
    const { userId } = req.params;
    if (!mongoose.isValidObjectId(userId) || !(await User.exists({ _id: userId }))) {
      return fail(res, 404, "User not found", ErrorCodes.USER_NOT_FOUND);
    }

    const limit = Math.min(
      Math.max(parseInt(req.query.limit, 10) || FOLLOW_LIMITS.PAGE_SIZE, 1),
      FOLLOW_LIMITS.MAX_PAGE_SIZE,
    );

    const filter = { [ownField]: userId };
    if (req.query.cursor) {
      const cursor = decodeCursor(req.query.cursor);
      if (!cursor) {
        return fail(res, 400, "Invalid cursor", ErrorCodes.VALIDATION_FAILED);
      }
      Object.assign(filter, afterCursor(cursor));
    }

    // One extra tells whether another page exists
    const follows = await Follow.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit + 1)
      .populate(otherField, USER_SUMMARY_FIELDS);

    const hasMore = follows.length > limit;
    const page = hasMore ? follows.slice(0, limit) : follows;
    // Accounts deleted since the follow are skipped
    const users = page.map((follow) => follow[otherField]).filter(Boolean);
    const followedIds = await getFollowedIds(
      req.user._id,
      users.map((user) => user._id),
    );

    return res.status(200).json(
      new ApiResponse(true, "Users fetched", {
        users: users.map((user) => formatUserSummary(user, followedIds.has(user._id.toString()))),
        nextCursor: hasMore ? encodeCursor(page[page.length - 1]) : null,
      }),
    );
  } catch (error) {
    console.error("List follows error:", error);
    return fail(res, 500, "Failed to fetch users", ErrorCodes.SERVER_ERROR);
  }
};

export const getFollowers = listFollows("following", "follower");
export const getFollowing = listFollows("follower", "following");
