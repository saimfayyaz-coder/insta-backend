import User from "../models/User.js";
import ApiResponse from "../utils/ApiResponse.js";
import { ErrorCodes } from "../utils/ErrorCodes.js";
import {
  optimizeAvatar,
  uploadToCloudinary,
  deleteFromCloudinary,
} from "../services/media.service.js";

const formatUserResponse = (user) => ({
  id: user._id,
  name: user.name,
  username: user.username,
  email: user.email,
  avatar: user.avatar,
  avatarUrl: user.avatar?.url || null,
  bio: user.bio,
  website: user.website,
  gender: user.gender,
  isVerified: user.isVerified,
});

export const getProfile = async (req, res) => {
  return res.status(200).json(
    new ApiResponse(true, "Profile fetched successfully", {
      user: formatUserResponse(req.user),
    }),
  );
};

export const getPublicProfile = async (req, res) => {
  try {
    const { username } = req.params;
    const cleanUsername = username?.trim().toLowerCase();

    const user = await User.findOne({ username: cleanUsername });
    if (!user) {
      return res
        .status(404)
        .json(
          new ApiResponse(
            false,
            "User not found",
            null,
            null,
            ErrorCodes.USER_NOT_FOUND,
          ),
        );
    }

    return res.status(200).json(
      new ApiResponse(true, "Public profile fetched successfully", {
        user: {
          id: user._id,
          name: user.name,
          username: user.username,
          avatar: user.avatar,
          avatarUrl: user.avatar?.url || null,
          bio: user.bio,
          website: user.website,
          isVerified: user.isVerified,
        },
      }),
    );
  } catch (error) {
    return res
      .status(500)
      .json(
        new ApiResponse(
          false,
          "Failed to fetch profile",
          null,
          null,
          ErrorCodes.SERVER_ERROR,
        ),
      );
  }
};

export const updateProfile = async (req, res) => {
  try {
    const { name, username, bio, website, gender } = req.body;
    const user = await User.findById(req.user._id);

    if (!user) {
      return res
        .status(404)
        .json(
          new ApiResponse(
            false,
            "User not found",
            null,
            null,
            ErrorCodes.USER_NOT_FOUND,
          ),
        );
    }

    const errors = {};

    if (name !== undefined) {
      if (typeof name !== "string" || name.trim().length > 50) {
        errors.name = ["Name cannot exceed 50 characters"];
      } else {
        user.name = name.trim();
      }
    }

    if (username !== undefined) {
      const cleanUsername = username.trim().toLowerCase();
      const usernameRegex = /^[a-zA-Z0-9._]+$/;

      if (!cleanUsername) {
        errors.username = ["Username is required"];
      } else if (cleanUsername.length < 3 || cleanUsername.length > 30) {
        errors.username = ["Username must be between 3 and 30 characters"];
      } else if (!usernameRegex.test(cleanUsername)) {
        errors.username = [
          "Username can only contain letters, numbers, periods, and underscores",
        ];
      } else if (cleanUsername !== user.username) {
        const existing = await User.findOne({
          username: cleanUsername,
          _id: { $ne: user._id },
        });

        if (existing) {
          errors.username = ["Username already in use"];
        } else {
          user.username = cleanUsername;
        }
      }
    }

    if (bio !== undefined) {
      if (typeof bio !== "string" || bio.length > 150) {
        errors.bio = ["Bio cannot exceed 150 characters"];
      } else {
        user.bio = bio;
      }
    }

    if (website !== undefined) {
      user.website = typeof website === "string" ? website.trim() : "";
    }

    if (gender !== undefined) {
      const allowedGenders = ["male", "female", "custom", "prefer_not_to_say"];
      if (allowedGenders.includes(gender)) {
        user.gender = gender;
      } else {
        errors.gender = ["Invalid gender option"];
      }
    }

    if (Object.keys(errors).length > 0) {
      return res
        .status(400)
        .json(
          new ApiResponse(
            false,
            "Validation failed",
            null,
            errors,
            ErrorCodes.VALIDATION_FAILED,
          ),
        );
    }

    await user.save();

    return res.status(200).json(
      new ApiResponse(true, "Profile updated successfully", {
        user: formatUserResponse(user),
      }),
    );
  } catch (error) {
    return res
      .status(500)
      .json(
        new ApiResponse(
          false,
          "Failed to update profile",
          null,
          null,
          ErrorCodes.SERVER_ERROR,
        ),
      );
  }
};

export const updateAvatar = async (req, res) => {
  try {
    if (!req.file) {
      return res
        .status(400)
        .json(
          new ApiResponse(
            false,
            "Image file is required",
            null,
            null,
            ErrorCodes.VALIDATION_FAILED,
          ),
        );
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res
        .status(404)
        .json(
          new ApiResponse(
            false,
            "User not found",
            null,
            null,
            ErrorCodes.USER_NOT_FOUND,
          ),
        );
    }

    const optimizedBuffer = await optimizeAvatar(req.file.buffer);
    const { url, publicId } = await uploadToCloudinary(optimizedBuffer);

    // Clean up previous image if exists
    if (user.avatar?.publicId) {
      await deleteFromCloudinary(user.avatar.publicId);
    }

    user.avatar = { url, publicId };
    await user.save();

    return res.status(200).json(
      new ApiResponse(true, "Avatar updated successfully", {
        user: formatUserResponse(user),
      }),
    );
  } catch (error) {
    console.error("Update avatar error:", error);
    return res
      .status(500)
      .json(
        new ApiResponse(
          false,
          "Failed to upload avatar",
          null,
          null,
          ErrorCodes.SERVER_ERROR,
        ),
      );
  }
};

export const removeAvatar = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res
        .status(404)
        .json(
          new ApiResponse(
            false,
            "User not found",
            null,
            null,
            ErrorCodes.USER_NOT_FOUND,
          ),
        );
    }

    if (user.avatar?.publicId) {
      await deleteFromCloudinary(user.avatar.publicId);
    }

    user.avatar = { url: null, publicId: null };
    await user.save();

    return res.status(200).json(
      new ApiResponse(true, "Avatar removed successfully", {
        user: formatUserResponse(user),
      }),
    );
  } catch (error) {
    return res
      .status(500)
      .json(
        new ApiResponse(
          false,
          "Failed to remove avatar",
          null,
          null,
          ErrorCodes.SERVER_ERROR,
        ),
      );
  }
};
