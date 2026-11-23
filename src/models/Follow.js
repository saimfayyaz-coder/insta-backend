import mongoose from "mongoose";

// One document per "follower follows following"
const followSchema = new mongoose.Schema(
  {
    follower: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    following: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true },
);

followSchema.index({ follower: 1, following: 1 }, { unique: true });
// Followers and following lists, newest first
followSchema.index({ following: 1, createdAt: -1, _id: -1 });
followSchema.index({ follower: 1, createdAt: -1, _id: -1 });

const Follow = mongoose.model("Follow", followSchema);

export default Follow;
