import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

import User from "../models/User.js";
import {
  generateAccessToken,
  generateRefreshToken,
  generateResetToken,
  verifyResetToken,
} from "../services/token.service.js";
import { generateOtp, sendOtpEmail } from "../services/otp.service.js";
import ApiResponse from "../utils/ApiResponse.js";
import { ErrorCodes } from "../utils/ErrorCodes.js";

const USERNAME_REGEX = /^[a-zA-Z0-9._]+$/;

/**
 * Check if a username is available in real time.
 */
export const checkUsername = async (req, res) => {
  try {
    const rawUsername = req.query.username;

    if (!rawUsername || !rawUsername.trim()) {
      return res.status(400).json(
        new ApiResponse(
          false,
          "Username is required",
          null,
          { username: ["Username is required"] },
          ErrorCodes.USERNAME_REQUIRED,
        ),
      );
    }

    const username = rawUsername.trim().toLowerCase();

    if (username.length < 3) {
      return res.status(400).json(
        new ApiResponse(
          false,
          "Username must be at least 3 characters",
          { isAvailable: false },
          { username: ["Username must be at least 3 characters"] },
          ErrorCodes.INVALID_USERNAME,
        ),
      );
    }

    if (username.length > 30) {
      return res.status(400).json(
        new ApiResponse(
          false,
          "Username cannot exceed 30 characters",
          { isAvailable: false },
          { username: ["Username cannot exceed 30 characters"] },
          ErrorCodes.INVALID_USERNAME,
        ),
      );
    }

    if (!USERNAME_REGEX.test(username)) {
      return res.status(400).json(
        new ApiResponse(
          false,
          "Username can only contain letters, numbers, periods, and underscores",
          { isAvailable: false },
          { username: ["Username can only contain letters, numbers, periods, and underscores"] },
          ErrorCodes.INVALID_USERNAME,
        ),
      );
    }

    const existingUser = await User.findOne({ username });

    if (existingUser) {
      return res.status(200).json(
        new ApiResponse(true, "Username is already taken", {
          username,
          isAvailable: false,
        }),
      );
    }

    return res.status(200).json(
      new ApiResponse(true, "Username is available", {
        username,
        isAvailable: true,
      }),
    );
  } catch (error) {
    console.error("Check username error:", error);
    return res
      .status(500)
      .json(new ApiResponse(false, "Internal server error", null, null, ErrorCodes.SERVER_ERROR));
  }
};

/**
 * Multi-step Signup: creates unverified user and sends 6-digit OTP email.
 */
export const signup = async (req, res) => {
  try {
    const { username, email, password, name = "" } = req.body;

    const errors = {};

    if (!username || !username.trim()) {
      errors.username = ["Username is required"];
    } else if (username.trim().length < 3) {
      errors.username = ["Username must be at least 3 characters"];
    } else if (!USERNAME_REGEX.test(username.trim())) {
      errors.username = [
        "Username can only contain letters, numbers, periods, and underscores",
      ];
    }

    if (!email || !email.trim()) {
      errors.email = ["Email is required"];
    } else if (!/^\S+@\S+\.\S+$/.test(email)) {
      errors.email = ["Please enter a valid email address"];
    }

    if (!password) {
      errors.password = ["Password is required"];
    } else if (password.length < 6) {
      errors.password = ["Password must be at least 6 characters"];
    }

    if (Object.keys(errors).length > 0) {
      return res
        .status(400)
        .json(new ApiResponse(false, "Validation failed", null, errors, ErrorCodes.VALIDATION_FAILED));
    }

    const normalizedUsername = username.trim().toLowerCase();
    const normalizedEmail = email.trim().toLowerCase();

    // Check if email already registered and verified
    const existingEmailUser = await User.findOne({ email: normalizedEmail });
    if (existingEmailUser && existingEmailUser.isVerified) {
      return res.status(409).json(
        new ApiResponse(
          false,
          "An account with this email already exists",
          null,
          { email: ["An account with this email already exists"] },
          ErrorCodes.EMAIL_ALREADY_EXISTS,
        ),
      );
    }

    // Check if username already registered and verified
    const existingUsernameUser = await User.findOne({ username: normalizedUsername });
    if (
      existingUsernameUser &&
      existingUsernameUser.isVerified &&
      existingUsernameUser.email !== normalizedEmail
    ) {
      return res.status(409).json(
        new ApiResponse(
          false,
          "This username is already taken",
          null,
          { username: ["This username is already taken"] },
          ErrorCodes.USERNAME_ALREADY_EXISTS,
        ),
      );
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const { code: otpCode, expiresAt: otpExpiresAt } = generateOtp();

    let user;
    if (existingEmailUser && !existingEmailUser.isVerified) {
      // User abandoned previous signup attempt with same email, update draft
      existingEmailUser.username = normalizedUsername;
      existingEmailUser.name = name.trim();
      existingEmailUser.password = hashedPassword;
      existingEmailUser.otp = { code: otpCode, expiresAt: otpExpiresAt };
      user = await existingEmailUser.save();
    } else {
      user = await User.create({
        username: normalizedUsername,
        name: name.trim(),
        email: normalizedEmail,
        password: hashedPassword,
        isVerified: false,
        otp: { code: otpCode, expiresAt: otpExpiresAt },
      });
    }

    await sendOtpEmail(normalizedEmail, otpCode, "signup_verification");

    return res.status(201).json(
      new ApiResponse(true, "Verification code sent to your email", {
        email: normalizedEmail,
        username: normalizedUsername,
        requiresOtp: true,
      }),
    );
  } catch (error) {
    console.error("Signup error:", error);
    return res
      .status(500)
      .json(new ApiResponse(false, "Internal server error", null, null, ErrorCodes.SERVER_ERROR));
  }
};

/**
 * Verify 6-digit OTP, activate account, and return auth tokens.
 */
export const verifyOtp = async (req, res) => {
  try {
    const { email, otp, purpose } = req.body;

    if (!email || !otp) {
      return res.status(400).json(
        new ApiResponse(
          false,
          "Email and 6-digit verification code are required",
          null,
          null,
          ErrorCodes.VALIDATION_FAILED,
        ),
      );
    }

    const normalizedEmail = email.trim().toLowerCase();
    const cleanOtp = otp.toString().trim();

    const user = await User.findOne({ email: normalizedEmail }).select("+otp");

    if (!user) {
      return res.status(404).json(
        new ApiResponse(false, "User not found", null, null, ErrorCodes.USER_NOT_FOUND),
      );
    }

    if (!user.otp || !user.otp.code) {
      return res.status(400).json(
        new ApiResponse(
          false,
          "No verification code pending. Please request a new one.",
          null,
          null,
          ErrorCodes.INVALID_OTP,
        ),
      );
    }

    if (new Date() > new Date(user.otp.expiresAt)) {
      return res.status(400).json(
        new ApiResponse(
          false,
          "Verification code has expired. Please request a new code.",
          null,
          null,
          ErrorCodes.OTP_EXPIRED,
        ),
      );
    }

    if (user.otp.code !== cleanOtp) {
      return res.status(400).json(
        new ApiResponse(
          false,
          "Incorrect verification code. Please check and try again.",
          null,
          { otp: ["Incorrect verification code"] },
          ErrorCodes.INVALID_OTP,
        ),
      );
    }

    // Clear the consumed OTP
    user.otp = { code: null, expiresAt: null };

    // If purpose is forgot_password, issue resetToken without logging in
    if (purpose === "forgot_password") {
      await user.save();
      const resetToken = generateResetToken(user._id, user.email);
      return res.status(200).json(
        new ApiResponse(true, "Code verified", {
          resetToken,
          email: user.email,
        }),
      );
    }

    // Activate user
    user.isVerified = true;

    const accessToken = generateAccessToken(user._id);
    const refreshToken = generateRefreshToken(user._id);

    user.refreshToken = refreshToken;
    await user.save();

    return res.status(200).json(
      new ApiResponse(true, "Email verified successfully", {
        user: {
          id: user._id,
          name: user.name,
          username: user.username,
          email: user.email,
          isVerified: user.isVerified,
        },
        accessToken,
        refreshToken,
      }),
    );
  } catch (error) {
    console.error("Verify OTP error:", error);
    return res
      .status(500)
      .json(new ApiResponse(false, "Internal server error", null, null, ErrorCodes.SERVER_ERROR));
  }
};

/**
 * Resend OTP code to user's email.
 */
export const resendOtp = async (req, res) => {
  try {
    const { email, purpose } = req.body;

    if (!email || !email.trim()) {
      return res.status(400).json(
        new ApiResponse(
          false,
          "Email is required",
          null,
          null,
          ErrorCodes.VALIDATION_FAILED,
        ),
      );
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      return res.status(404).json(
        new ApiResponse(false, "User not found", null, null, ErrorCodes.USER_NOT_FOUND),
      );
    }

    if (user.isVerified && purpose !== "forgot_password") {
      return res.status(400).json(
        new ApiResponse(false, "Email is already verified", null, null, ErrorCodes.VALIDATION_FAILED),
      );
    }

    const { code: newOtp, expiresAt: newExpiresAt } = generateOtp();
    user.otp = { code: newOtp, expiresAt: newExpiresAt };
    await user.save();

    await sendOtpEmail(
      normalizedEmail,
      newOtp,
      purpose === "forgot_password" ? "forgot_password" : "resend_verification",
    );

    return res.status(200).json(
      new ApiResponse(true, "A new verification code has been sent to your email", {
        email: normalizedEmail,
      }),
    );
  } catch (error) {
    console.error("Resend OTP error:", error);
    return res
      .status(500)
      .json(new ApiResponse(false, "Internal server error", null, null, ErrorCodes.SERVER_ERROR));
  }
};

/**
 * Login supporting both Username OR Email, with unverified account detection.
 */
export const login = async (req, res) => {
  try {
    const { identifier, email, password } = req.body;
    const loginIdentifier = (identifier || email || "").trim();

    const errors = {};

    if (!loginIdentifier) {
      errors.identifier = ["Username or email is required"];
    }

    if (!password) {
      errors.password = ["Password is required"];
    }

    if (Object.keys(errors).length > 0) {
      return res
        .status(400)
        .json(new ApiResponse(false, "Validation failed", null, errors, ErrorCodes.VALIDATION_FAILED));
    }

    const isEmail = /^\S+@\S+\.\S+$/.test(loginIdentifier);
    const normalizedIdentifier = loginIdentifier.toLowerCase();

    const user = await User.findOne(
      isEmail ? { email: normalizedIdentifier } : { username: normalizedIdentifier },
    ).select("+password");

    if (!user) {
      return res.status(400).json(
        new ApiResponse(
          false,
          "Invalid credentials",
          null,
          { identifier: ["No account found with this username or email"] },
          ErrorCodes.INVALID_CREDENTIALS,
        ),
      );
    }

    const isPasswordCorrect = await bcrypt.compare(password, user.password);

    if (!isPasswordCorrect) {
      return res.status(400).json(
        new ApiResponse(
          false,
          "Invalid credentials",
          null,
          { password: ["Incorrect password"] },
          ErrorCodes.INVALID_CREDENTIALS,
        ),
      );
    }

    // If user is not yet verified, send a fresh OTP and prompt for OTP verification
    if (!user.isVerified) {
      const { code: newOtp, expiresAt } = generateOtp();
      user.otp = { code: newOtp, expiresAt };
      await user.save();

      await sendOtpEmail(user.email, newOtp, "unverified_login");

      return res.status(403).json(
        new ApiResponse(
          false,
          "Your email is not verified. A new confirmation code has been sent.",
          {
            email: user.email,
            username: user.username,
            requiresVerification: true,
          },
          null,
          ErrorCodes.EMAIL_NOT_VERIFIED,
        ),
      );
    }

    const accessToken = generateAccessToken(user._id);
    const refreshToken = generateRefreshToken(user._id);

    user.refreshToken = refreshToken;
    await user.save();

    return res.status(200).json(
      new ApiResponse(true, "Login successful", {
        user: {
          id: user._id,
          name: user.name,
          username: user.username,
          email: user.email,
          isVerified: user.isVerified,
        },
        accessToken,
        refreshToken,
      }),
    );
  } catch (error) {
    console.error("Login error:", error);
    return res
      .status(500)
      .json(new ApiResponse(false, "Internal server error", null, null, ErrorCodes.SERVER_ERROR));
  }
};

export const refreshAccessToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res
        .status(401)
        .json(new ApiResponse(false, "Refresh token is required", null, null, ErrorCodes.REFRESH_TOKEN_REQUIRED));
    }

    const decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
    const user = await User.findById(decoded.userId).select("+refreshToken");

    if (!user || user.refreshToken !== refreshToken) {
      return res
        .status(401)
        .json(new ApiResponse(false, "Invalid refresh token", null, null, ErrorCodes.REFRESH_TOKEN_INVALID));
    }

    const newAccessToken = generateAccessToken(user._id);

    return res.status(200).json(
      new ApiResponse(true, "Token refreshed successfully", {
        accessToken: newAccessToken,
      }),
    );
  } catch (error) {
    return res
      .status(401)
      .json(new ApiResponse(false, "Invalid or expired refresh token", null, null, ErrorCodes.REFRESH_TOKEN_EXPIRED));
  }
};

export const logout = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (refreshToken) {
      try {
        const decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
        await User.findByIdAndUpdate(decoded.userId, { refreshToken: null });
      } catch {
        // Continue even if token already expired
      }
    }

    return res.status(200).json(new ApiResponse(true, "Logout successful"));
  } catch (error) {
    console.error("Logout error:", error);
    return res.status(500).json(new ApiResponse(false, "Logout failed", null, null, ErrorCodes.SERVER_ERROR));
  }
};

export const getCurrentUser = async (req, res) => {
  return res.status(200).json(
    new ApiResponse(true, "Current user fetched successfully", {
      user: {
        id: req.user._id,
        name: req.user.name,
        username: req.user.username,
        email: req.user.email,
        isVerified: req.user.isVerified,
      },
    }),
  );
};

export const registerDeviceToken = async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res
        .status(400)
        .json(new ApiResponse(false, "Device token is required", null, null, ErrorCodes.DEVICE_TOKEN_REQUIRED));
    }

    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json(new ApiResponse(false, "User not found", null, null, ErrorCodes.USER_NOT_FOUND));
    }

    user.deviceToken = token;
    await user.save();

    return res
      .status(200)
      .json(new ApiResponse(true, "Device token registered successfully"));
  } catch (error) {
    return res
      .status(500)
      .json(new ApiResponse(false, "Failed to register device token", null, null, ErrorCodes.SERVER_ERROR));
  }
};

/**
 * Request password reset OTP via email or username.
 */
export const forgotPassword = async (req, res) => {
  try {
    const { identifier } = req.body;

    if (!identifier || !identifier.trim()) {
      return res.status(400).json(
        new ApiResponse(
          false,
          "Username or email is required",
          null,
          { identifier: ["Username or email is required"] },
          ErrorCodes.VALIDATION_FAILED,
        ),
      );
    }

    const cleanIdentifier = identifier.trim().toLowerCase();
    const isEmail = /^\S+@\S+\.\S+$/.test(cleanIdentifier);

    const user = await User.findOne(
      isEmail ? { email: cleanIdentifier } : { username: cleanIdentifier },
    );

    if (!user) {
      return res.status(404).json(
        new ApiResponse(
          false,
          "No account found with this username or email",
          null,
          { identifier: ["No account found with this username or email"] },
          ErrorCodes.USER_NOT_FOUND,
        ),
      );
    }

    const { code: otpCode, expiresAt: otpExpiresAt } = generateOtp();
    user.otp = { code: otpCode, expiresAt: otpExpiresAt };
    await user.save();

    await sendOtpEmail(user.email, otpCode, "forgot_password");

    return res.status(200).json(
      new ApiResponse(true, "Verification code sent to your email", {
        email: user.email,
      }),
    );
  } catch (error) {
    console.error("Forgot password error:", error);
    return res
      .status(500)
      .json(new ApiResponse(false, "Internal server error", null, null, ErrorCodes.SERVER_ERROR));
  }
};

/**
 * Reset password using verified resetToken.
 */
export const resetPassword = async (req, res) => {
  try {
    const { email, resetToken, newPassword } = req.body;

    const errors = {};
    if (!email || !email.trim()) {
      errors.email = ["Email is required"];
    }
    if (!resetToken || !resetToken.trim()) {
      errors.resetToken = ["Reset token is required"];
    }
    if (!newPassword) {
      errors.newPassword = ["Password is required"];
    } else if (newPassword.length < 6) {
      errors.newPassword = ["Password must be at least 6 characters"];
    }

    if (Object.keys(errors).length > 0) {
      return res
        .status(400)
        .json(new ApiResponse(false, "Validation failed", null, errors, ErrorCodes.VALIDATION_FAILED));
    }

    let decoded;
    try {
      decoded = verifyResetToken(resetToken);
    } catch {
      return res.status(401).json(
        new ApiResponse(
          false,
          "Reset link or token has expired or is invalid. Please request a new code.",
          null,
          null,
          ErrorCodes.INVALID_RESET_TOKEN,
        ),
      );
    }

    const normalizedEmail = email.trim().toLowerCase();
    if (!decoded || decoded.purpose !== "reset_password" || decoded.email.toLowerCase() !== normalizedEmail) {
      return res.status(401).json(
        new ApiResponse(
          false,
          "Invalid reset token.",
          null,
          null,
          ErrorCodes.INVALID_RESET_TOKEN,
        ),
      );
    }

    const user = await User.findById(decoded.userId).select("+refreshToken");
    if (!user) {
      return res.status(404).json(
        new ApiResponse(false, "User not found", null, null, ErrorCodes.USER_NOT_FOUND),
      );
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);
    user.password = hashedPassword;
    user.isVerified = true;

    const accessToken = generateAccessToken(user._id);
    const refreshToken = generateRefreshToken(user._id);
    user.refreshToken = refreshToken;
    await user.save();

    return res.status(200).json(
      new ApiResponse(true, "Password reset successfully", {
        user: {
          id: user._id,
          name: user.name,
          username: user.username,
          email: user.email,
          isVerified: user.isVerified,
        },
        accessToken,
        refreshToken,
      }),
    );
  } catch (error) {
    console.error("Reset password error:", error);
    return res
      .status(500)
      .json(new ApiResponse(false, "Internal server error", null, null, ErrorCodes.SERVER_ERROR));
  }
};

