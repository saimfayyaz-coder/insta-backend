import express from "express";

import {
  checkUsername,
  signup,
  verifyOtp,
  resendOtp,
  login,
  refreshAccessToken,
  logout,
  getCurrentUser,
  registerDeviceToken,
} from "../controllers/auth.controller.js";

import { protect } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.get("/check-username", checkUsername);

router.post("/signup", signup);

router.post("/verify-otp", verifyOtp);

router.post("/resend-otp", resendOtp);

router.post("/login", login);

router.post("/refresh-token", refreshAccessToken);

router.post("/logout", logout);

router.get("/me", protect, getCurrentUser);

router.post("/me/device-token", protect, registerDeviceToken);

export default router;
