// Recounts every post's commentCount from its Comment documents.
// A crash between saving a comment and bumping the count can leave the two apart; this puts them back.
// Run: npm run reconcile:comments
import "dotenv/config";
import mongoose from "mongoose";
import Post from "../src/models/Post.js";
import Comment from "../src/models/Comment.js";

const run = async () => {
  await mongoose.connect(process.env.MONGODB_URI);

  const counts = await Comment.aggregate([{ $group: { _id: "$post", count: { $sum: 1 } } }]);
  const countByPost = new Map(counts.map(({ _id, count }) => [_id.toString(), count]));

  let fixed = 0;
  for await (const post of Post.find().select("commentCount").cursor()) {
    const actual = countByPost.get(post._id.toString()) || 0;
    if (post.commentCount !== actual) {
      await Post.updateOne({ _id: post._id }, { $set: { commentCount: actual } });
      fixed += 1;
    }
  }

  // Comments whose post was deleted
  const postIds = [...countByPost.keys()];
  const existing = new Set((await Post.find({ _id: { $in: postIds } }).distinct("_id")).map(String));
  const orphanIds = postIds.filter((id) => !existing.has(id));
  const { deletedCount } = await Comment.deleteMany({ post: { $in: orphanIds } });

  console.log(`[reconcile:comments] fixed ${fixed} counts, removed ${deletedCount} orphan comments`);
  await mongoose.disconnect();
};

run().catch((error) => {
  console.error("[reconcile:comments] failed:", error);
  process.exit(1);
});
