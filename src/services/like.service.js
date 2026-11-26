import PostLike from "../models/PostLike.js";
import Notification from "../models/Notification.js";
import { LIKE_LIMITS, NOTIFICATION_TYPES } from "../utils/likeLimits.js";
import { createAndSendNotification } from "./notification/notification.service.js";

// Ids (as strings) of the given posts that the viewer liked, in one query
export const getLikedPostIds = async (viewerId, postIds) => {
  if (postIds.length === 0) return new Set();
  const likes = await PostLike.find({ user: viewerId, post: { $in: postIds } }).select("post");
  return new Set(likes.map((like) => like.post.toString()));
};

export const hasLikedPost = async (viewerId, postId) =>
  Boolean(await PostLike.exists({ user: viewerId, post: postId }));

// Fixed window per user, kept in memory; enough for one server process
const toggleWindows = new Map();

export const isLikeToggleRateLimited = (userId) => {
  const key = userId.toString();
  const now = Date.now();
  const window = toggleWindows.get(key);

  if (!window || now - window.startedAt >= LIKE_LIMITS.TOGGLE_WINDOW_MS) {
    // Drop finished windows now and then so the map can't grow forever
    if (toggleWindows.size > LIKE_LIMITS.MAX_TOGGLES_PER_WINDOW * 100) {
      toggleWindows.forEach((value, id) => {
        if (now - value.startedAt >= LIKE_LIMITS.TOGGLE_WINDOW_MS) toggleWindows.delete(id);
      });
    }
    toggleWindows.set(key, { startedAt: now, count: 1 });
    return false;
  }

  window.count += 1;
  return window.count > LIKE_LIMITS.MAX_TOGGLES_PER_WINDOW;
};

// Tells the author about a new like; liking, unliking and liking again sends one push, not three
export const notifyPostLiked = async ({ post, liker }) => {
  if (post.author._id.equals(liker._id)) return;

  const alreadyNotified = await Notification.exists({
    recipient: post.author._id,
    sender: liker._id,
    type: NOTIFICATION_TYPES.POST_LIKE,
    "data.postId": post._id.toString(),
    createdAt: { $gt: new Date(Date.now() - LIKE_LIMITS.NOTIFICATION_DEDUPE_MS) },
  });
  if (alreadyNotified) return;

  await createAndSendNotification({
    recipient: post.author._id,
    sender: liker._id,
    type: NOTIFICATION_TYPES.POST_LIKE,
    title: "New like",
    body: `${liker.username} liked your post`,
    data: { type: NOTIFICATION_TYPES.POST_LIKE, postId: post._id.toString() },
  });
};

// Removes the likes and like notifications of deleted posts
export const deleteLikesForPost = async (postId) => {
  await PostLike.deleteMany({ post: postId });
  await Notification.deleteMany({
    type: NOTIFICATION_TYPES.POST_LIKE,
    "data.postId": postId.toString(),
  });
};
