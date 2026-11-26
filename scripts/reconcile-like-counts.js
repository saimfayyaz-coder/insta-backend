// Recounts every post's likeCount from its PostLike documents.
// A crash between saving a like and bumping the count can leave the two apart; this puts them back.
// Run: npm run reconcile:likes
import "dotenv/config";
import mongoose from "mongoose";
import Post from "../src/models/Post.js";
import PostLike from "../src/models/PostLike.js";

const run = async () => {
  await mongoose.connect(process.env.MONGODB_URI);

  const counts = await PostLike.aggregate([{ $group: { _id: "$post", count: { $sum: 1 } } }]);
  const countByPost = new Map(counts.map(({ _id, count }) => [_id.toString(), count]));

  let fixed = 0;
  for await (const post of Post.find().select("likeCount").cursor()) {
    const actual = countByPost.get(post._id.toString()) || 0;
    if (post.likeCount !== actual) {
      await Post.updateOne({ _id: post._id }, { $set: { likeCount: actual } });
      fixed += 1;
    }
  }

  // Likes whose post was deleted
  const postIds = [...countByPost.keys()];
  const existing = new Set((await Post.find({ _id: { $in: postIds } }).distinct("_id")).map(String));
  const orphanIds = postIds.filter((id) => !existing.has(id));
  const { deletedCount } = await PostLike.deleteMany({ post: { $in: orphanIds } });

  console.log(`[reconcile:likes] fixed ${fixed} counts, removed ${deletedCount} orphan likes`);
  await mongoose.disconnect();
};

run().catch((error) => {
  console.error("[reconcile:likes] failed:", error);
  process.exit(1);
});
