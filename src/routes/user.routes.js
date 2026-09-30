import express from "express";
import { protect } from "../middlewares/auth.middleware.js";
import { uploadAvatar as uploadAvatarMiddleware } from "../middlewares/upload.middleware.js";
import {
  getProfile,
  getPublicProfile,
  updateProfile,
  updateAvatar,
  removeAvatar,
} from "../controllers/user.controller.js";

const router = express.Router();

router.get("/profile", protect, getProfile);
router.get("/:username", protect, getPublicProfile);
router.patch("/profile", protect, updateProfile);
router.post(
  "/profile/avatar",
  protect,
  uploadAvatarMiddleware.single("avatar"),
  updateAvatar,
);
router.delete("/profile/avatar", protect, removeAvatar);

export default router;
