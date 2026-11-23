import express from "express";
import { protect } from "../middlewares/auth.middleware.js";
import { createPost, getFeed, getPost, deletePost } from "../controllers/post.controller.js";

const router = express.Router();

router.use(protect);

router.post("/", createPost);
router.get("/feed", getFeed);
router.get("/:postId", getPost);
router.delete("/:postId", deletePost);

export default router;
