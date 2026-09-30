import sharp from "sharp";
import cloudinary from "../config/cloudinary.js";

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
