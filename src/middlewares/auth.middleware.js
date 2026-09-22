import jwt from "jsonwebtoken";

import User from "../models/User.js";
import ApiResponse from "../utils/ApiResponse.js";
import { ErrorCodes } from "../utils/ErrorCodes.js";

export const protect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    // Check Authorization header
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res
        .status(401)
        .json(new ApiResponse(false, "Access token is required", null, null, ErrorCodes.TOKEN_REQUIRED));
    }

    // Extract token
    const accessToken = authHeader.split(" ")[1];

    // Verify access token
    const decoded = jwt.verify(accessToken, process.env.ACCESS_TOKEN_SECRET);

    // Find user
    const user = await User.findById(decoded.userId);

    if (!user) {
      return res.status(401).json(new ApiResponse(false, "User not found", null, null, ErrorCodes.USER_NOT_FOUND));
    }

    // Attach authenticated user to request
    req.user = user;

    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return res
        .status(401)
        .json(new ApiResponse(false, "Access token has expired", null, null, ErrorCodes.TOKEN_EXPIRED));
    }

    if (error.name === "JsonWebTokenError") {
      return res
        .status(401)
        .json(new ApiResponse(false, "Invalid access token", null, null, ErrorCodes.TOKEN_INVALID));
    }

    console.error("Authentication error:", error);

    return res
      .status(500)
      .json(new ApiResponse(false, "Internal server error", null, null, ErrorCodes.SERVER_ERROR));
  }
};
