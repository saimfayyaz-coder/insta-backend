import mongoose from "mongoose";

// One document per "user likes post"; the post's likeCount mirrors how many exist
const postLikeSchema = new mongoose.Schema(
  {
    post: { type: mongoose.Schema.Types.ObjectId, ref: "Post", required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true },
);

// A user can like a post once; also settles two like requests racing each other
postLikeSchema.index({ post: 1, user: 1 }, { unique: true });
// Who liked a post, newest first
postLikeSchema.index({ post: 1, createdAt: -1, _id: -1 });
// Posts a user liked, newest first
postLikeSchema.index({ user: 1, createdAt: -1, _id: -1 });

const PostLike = mongoose.model("PostLike", postLikeSchema);

export default PostLike;
