import express from "express";
import { protect } from "../middlewares/auth.middleware.js";
import { uploadAvatar as uploadAvatarMiddleware } from "../middlewares/upload.middleware.js";
import {
  getProfile,
  getPublicProfile,
  updateProfile,
  updateAvatar,
  removeAvatar,
  addLink,
  editLink,
  deleteLink,
} from "../controllers/user.controller.js";

const router = express.Router();

router.get("/profile", protect, getProfile);
router.route("/profile").patch(protect, updateProfile).put(protect, updateProfile);
router.post(
  "/profile/avatar",
  protect,
  uploadAvatarMiddleware.single("avatar"),
  updateAvatar,
);
router.delete("/profile/avatar", protect, removeAvatar);

router.post("/profile/links", protect, addLink);
router.patch("/profile/links/:linkId", protect, editLink);
router.delete("/profile/links/:linkId", protect, deleteLink);

router.get("/:username", protect, getPublicProfile);

export default router;
