import express from "express";
import { protect } from "../middlewares/auth.middleware.js";
import { createPost, getFeed, getPost, deletePost } from "../controllers/post.controller.js";
import { likePost, unlikePost, getPostLikers } from "../controllers/like.controller.js";
import {
  getPostComments,
  createComment,
  deleteComment,
} from "../controllers/comment.controller.js";

const router = express.Router();

router.use(protect);

router.post("/", createPost);
router.get("/feed", getFeed);
router.get("/:postId", getPost);
router.delete("/:postId", deletePost);

// Like and unlike are idempotent, so a retried request can never flip the state back
router.post("/:postId/like", likePost);
router.delete("/:postId/like", unlikePost);
router.get("/:postId/likes", getPostLikers);

router.get("/:postId/comments", getPostComments);
router.post("/:postId/comments", createComment);
router.delete("/:postId/comments/:commentId", deleteComment);

export default router;
