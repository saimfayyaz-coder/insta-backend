import mongoose from "mongoose";
import { COMMENT_LIMITS } from "../utils/commentLimits.js";

// One document per comment on a post; the post's commentCount mirrors how many exist
const commentSchema = new mongoose.Schema(
  {
    post: { type: mongoose.Schema.Types.ObjectId, ref: "Post", required: true },
    author: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    text: {
      type: String,
      trim: true,
      required: true,
      maxlength: COMMENT_LIMITS.MAX_LENGTH,
    },
    mentions: { type: [String], default: [] },
    // Sent by the app so a retried create returns the same comment instead of a duplicate
    clientRequestId: { type: String, default: null },
  },
  { timestamps: true },
);

// Comments on a post, newest first
commentSchema.index({ post: 1, createdAt: -1, _id: -1 });
// Comments written by a user, newest first
commentSchema.index({ author: 1, createdAt: -1, _id: -1 });
// Prevents duplicate comments when a create request is retried
commentSchema.index(
  { post: 1, author: 1, clientRequestId: 1 },
  { unique: true, partialFilterExpression: { clientRequestId: { $type: "string" } } },
);

const Comment = mongoose.model("Comment", commentSchema);

export default Comment;
