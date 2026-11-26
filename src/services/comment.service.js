import Comment from "../models/Comment.js";
import Notification from "../models/Notification.js";
import {
  COMMENT_LIMITS,
  COMMENT_NOTIFICATION_TYPES,
} from "../utils/commentLimits.js";
import { createAndSendNotification } from "./notification/notification.service.js";

// Fixed window per user, kept in memory; enough for one server process
const commentWindows = new Map();

export const isCommentRateLimited = (userId) => {
  const key = userId.toString();
  const now = Date.now();
  const window = commentWindows.get(key);

  if (!window || now - window.startedAt >= COMMENT_LIMITS.WINDOW_MS) {
    // Drop finished windows now and then so the map can't grow forever
    if (commentWindows.size > COMMENT_LIMITS.MAX_COMMENTS_PER_WINDOW * 100) {
      commentWindows.forEach((value, id) => {
        if (now - value.startedAt >= COMMENT_LIMITS.WINDOW_MS) {
          commentWindows.delete(id);
        }
      });
    }
    commentWindows.set(key, { startedAt: now, count: 1 });
    return false;
  }

  window.count += 1;
  return window.count > COMMENT_LIMITS.MAX_COMMENTS_PER_WINDOW;
};

const formatPreview = (text) =>
  text.length > COMMENT_LIMITS.NOTIFICATION_PREVIEW_LENGTH
    ? `${text.slice(0, COMMENT_LIMITS.NOTIFICATION_PREVIEW_LENGTH - 1).trimEnd()}…`
    : text;

// Tells the post author about a new comment
export const notifyPostCommented = async ({ post, comment, commenter }) => {
  if (post.author._id.equals(commenter._id)) return;

  await createAndSendNotification({
    recipient: post.author._id,
    sender: commenter._id,
    type: COMMENT_NOTIFICATION_TYPES.POST_COMMENT,
    title: "New comment",
    body: `${commenter.username} commented: "${formatPreview(comment.text)}"`,
    data: {
      type: COMMENT_NOTIFICATION_TYPES.POST_COMMENT,
      postId: post._id.toString(),
      commentId: comment._id.toString(),
    },
  });
};

// Removes the comments and comment notifications of a deleted post
export const deleteCommentsForPost = async (postId) => {
  await Comment.deleteMany({ post: postId });
  await Notification.deleteMany({
    type: COMMENT_NOTIFICATION_TYPES.POST_COMMENT,
    "data.postId": postId.toString(),
  });
};

// Removes the notification tied to a deleted comment
export const deleteCommentNotification = async (commentId) => {
  await Notification.deleteMany({
    type: COMMENT_NOTIFICATION_TYPES.POST_COMMENT,
    "data.commentId": commentId.toString(),
  });
};
