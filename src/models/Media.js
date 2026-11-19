import mongoose from "mongoose";
import { MEDIA_STATUS, POST_ASPECT_RATIOS } from "../utils/postLimits.js";

// An uploaded post image; stays pending until a post uses it
const mediaSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    url: { type: String, required: true },
    publicId: { type: String, required: true },
    thumbUrl: { type: String, required: true },
    thumbPublicId: { type: String, required: true },
    width: { type: Number, required: true },
    height: { type: Number, required: true },
    aspectRatio: {
      type: Number,
      required: true,
      enum: Object.values(POST_ASPECT_RATIOS),
    },
    status: {
      type: String,
      enum: Object.values(MEDIA_STATUS),
      default: MEDIA_STATUS.PENDING,
    },
  },
  { timestamps: true },
);

mediaSchema.index({ owner: 1, status: 1, createdAt: 1 });

const Media = mongoose.model("Media", mediaSchema);

export default Media;
