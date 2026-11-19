import multer from "multer";
import ApiResponse from "../utils/ApiResponse.js";
import { ErrorCodes } from "../utils/ErrorCodes.js";
import { POST_LIMITS } from "../utils/postLimits.js";

const storage = multer.memoryStorage();

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

class InvalidImageTypeError extends Error {}

const fileFilter = (req, file, cb) => {
  if (ALLOWED_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new InvalidImageTypeError("Only JPEG, PNG, and WebP images are allowed"), false);
  }
};

export const uploadAvatar = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
  fileFilter,
});

const postImageUpload = multer({
  storage,
  limits: {
    fileSize: POST_LIMITS.IMAGE_MAX_BYTES,
    files: 1,
  },
  fileFilter,
});

// Turns multer failures into the normal API error shape instead of an HTML 500
export const uploadPostImage = (fieldName) => (req, res, next) => {
  postImageUpload.single(fieldName)(req, res, (error) => {
    if (!error) return next();

    if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
      return res
        .status(413)
        .json(new ApiResponse(false, "Image is too large", null, null, ErrorCodes.FILE_TOO_LARGE));
    }

    if (error instanceof InvalidImageTypeError || error instanceof multer.MulterError) {
      return res
        .status(400)
        .json(new ApiResponse(false, error.message, null, null, ErrorCodes.INVALID_IMAGE));
    }

    return next(error);
  });
};
