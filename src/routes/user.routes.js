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
  searchUsers,
} from "../controllers/user.controller.js";
import { getUserPosts } from "../controllers/post.controller.js";
import {
  followUser,
  unfollowUser,
  getFollowers,
  getFollowing,
} from "../controllers/follow.controller.js";

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

router.get("/search", protect, searchUsers);

router.get("/:userId/posts", protect, getUserPosts);
router.post("/:userId/follow", protect, followUser);
router.delete("/:userId/follow", protect, unfollowUser);
router.get("/:userId/followers", protect, getFollowers);
router.get("/:userId/following", protect, getFollowing);
router.get("/:username", protect, getPublicProfile);

export default router;
