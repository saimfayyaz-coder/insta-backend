import Media from "../models/Media.js";
import ApiResponse from "../utils/ApiResponse.js";
import { ErrorCodes } from "../utils/ErrorCodes.js";
import {
  CLOUDINARY_FOLDERS,
  MEDIA_STATUS,
  POST_ASPECT_RATIOS,
  POST_LIMITS,
} from "../utils/postLimits.js";
import {
  createPostThumbnail,
  deleteManyFromCloudinary,
  isDecodableImage,
  optimizePostImage,
  uploadToCloudinary,
} from "../services/media.service.js";

const fail = (res, status, message, code) =>
  res.status(status).json(new ApiResponse(false, message, null, null, code));

// Serverless has no cron, so each upload clears that user's abandoned images
const removeStalePendingMedia = async (ownerId) => {
  const cutoff = new Date(Date.now() - POST_LIMITS.PENDING_MEDIA_TTL_MS);
  const stale = await Media.find({
    owner: ownerId,
    status: MEDIA_STATUS.PENDING,
    createdAt: { $lt: cutoff },
  }).lean();

  if (stale.length === 0) return;

  await Media.deleteMany({ _id: { $in: stale.map((item) => item._id) } });
  await deleteManyFromCloudinary(stale.flatMap((item) => [item.publicId, item.thumbPublicId]));
};

export const uploadPostImage = async (req, res) => {
  try {
    if (!req.file) {
      return fail(res, 400, "Image file is required", ErrorCodes.POST_MEDIA_REQUIRED);
    }

    const aspectRatio = Number(req.body.aspectRatio);
    if (!Object.values(POST_ASPECT_RATIOS).includes(aspectRatio)) {
      return fail(res, 400, "Unsupported aspect ratio", ErrorCodes.INVALID_ASPECT_RATIO);
    }

    if (!(await isDecodableImage(req.file.buffer))) {
      return fail(res, 400, "File is not a valid image", ErrorCodes.INVALID_IMAGE);
    }

    await removeStalePendingMedia(req.user._id).catch((error) =>
      console.error("Stale media cleanup error:", error),
    );

    const pendingCount = await Media.countDocuments({
      owner: req.user._id,
      status: MEDIA_STATUS.PENDING,
    });
    if (pendingCount >= POST_LIMITS.MAX_PENDING_MEDIA) {
      return fail(res, 429, "Too many unposted images", ErrorCodes.RATE_LIMITED);
    }

    const [optimized, thumbBuffer] = await Promise.all([
      optimizePostImage(req.file.buffer, aspectRatio),
      createPostThumbnail(req.file.buffer),
    ]);

    const [imageResult, thumbResult] = await Promise.allSettled([
      uploadToCloudinary(optimized.buffer, CLOUDINARY_FOLDERS.POSTS),
      uploadToCloudinary(thumbBuffer, CLOUDINARY_FOLDERS.POST_THUMBS),
    ]);

    if (imageResult.status === "rejected" || thumbResult.status === "rejected") {
      console.error("Post image upload error:", imageResult.reason || thumbResult.reason);
      // Don't leave half of the pair behind
      await deleteManyFromCloudinary([imageResult.value?.publicId, thumbResult.value?.publicId]);
      return fail(res, 502, "Failed to store image", ErrorCodes.UPLOAD_FAILED);
    }

    const image = imageResult.value;
    const thumb = thumbResult.value;

    const media = await Media.create({
      owner: req.user._id,
      url: image.url,
      publicId: image.publicId,
      thumbUrl: thumb.url,
      thumbPublicId: thumb.publicId,
      width: optimized.width,
      height: optimized.height,
      aspectRatio,
    });

    return res.status(201).json(
      new ApiResponse(true, "Image uploaded", {
        media: {
          id: media._id.toString(),
          url: media.url,
          thumbUrl: media.thumbUrl,
          width: media.width,
          height: media.height,
        },
      }),
    );
  } catch (error) {
    console.error("Upload post image error:", error);
    return fail(res, 500, "Failed to upload image", ErrorCodes.SERVER_ERROR);
  }
};
