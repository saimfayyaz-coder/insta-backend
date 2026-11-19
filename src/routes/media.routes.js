import express from "express";
import { protect } from "../middlewares/auth.middleware.js";
import { uploadPostImage as uploadPostImageMiddleware } from "../middlewares/upload.middleware.js";
import { uploadPostImage } from "../controllers/media.controller.js";

const router = express.Router();

router.post("/images", protect, uploadPostImageMiddleware("image"), uploadPostImage);

export default router;
