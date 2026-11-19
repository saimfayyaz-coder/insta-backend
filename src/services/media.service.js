import sharp from "sharp";
import cloudinary from "../config/cloudinary.js";
import { POST_IMAGE } from "../utils/postLimits.js";

export const optimizeAvatar = async (buffer) => {
  return await sharp(buffer)
    .rotate()
    .resize(500, 500, {
      fit: "cover",
      position: "center",
    })
    .webp({ quality: 80, effort: 4 })
    .toBuffer();
};

export const uploadToCloudinary = (buffer, folder = "instagram/avatars") => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: "image",
        format: "webp",
      },
      (error, result) => {
        if (error) return reject(error);
        resolve({
          url: result.secure_url,
          publicId: result.public_id,
        });
      },
    );

    uploadStream.end(buffer);
  });
};

export const deleteFromCloudinary = async (publicId) => {
  if (!publicId) return;
  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (error) {
    console.error("Cloudinary delete error:", error);
  }
};

// Crops to the post shape at 1080 wide. sharp drops EXIF (including GPS) unless asked to keep it.
export const optimizePostImage = async (buffer, aspectRatio) => {
  const height = Math.round(POST_IMAGE.WIDTH / aspectRatio);
  const { data, info } = await sharp(buffer, { limitInputPixels: POST_IMAGE.MAX_INPUT_PIXELS })
    .rotate()
    .resize(POST_IMAGE.WIDTH, height, { fit: "cover", position: "center" })
    .webp({ quality: POST_IMAGE.QUALITY, effort: 4 })
    .toBuffer({ resolveWithObject: true });

  return { buffer: data, width: info.width, height: info.height };
};

export const createPostThumbnail = async (buffer) => {
  return await sharp(buffer, { limitInputPixels: POST_IMAGE.MAX_INPUT_PIXELS })
    .rotate()
    .resize(POST_IMAGE.THUMB_WIDTH, POST_IMAGE.THUMB_HEIGHT, {
      fit: "cover",
      position: "center",
    })
    .webp({ quality: POST_IMAGE.THUMB_QUALITY, effort: 4 })
    .toBuffer();
};

// Decodes the header so a renamed or broken file is rejected before any processing
export const isDecodableImage = async (buffer) => {
  try {
    const metadata = await sharp(buffer, {
      limitInputPixels: POST_IMAGE.MAX_INPUT_PIXELS,
    }).metadata();
    return Boolean(metadata.width && metadata.height);
  } catch {
    return false;
  }
};

export const deleteManyFromCloudinary = async (publicIds) => {
  await Promise.allSettled(publicIds.filter(Boolean).map(deleteFromCloudinary));
};
