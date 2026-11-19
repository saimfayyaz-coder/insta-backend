import mongoose from "mongoose";
import { POST_LIMITS, POST_ASPECT_RATIOS } from "../utils/postLimits.js";

const postMediaSchema = new mongoose.Schema(
  {
    media: { type: mongoose.Schema.Types.ObjectId, ref: "Media", required: true },
    url: { type: String, required: true },
    publicId: { type: String, required: true },
    thumbUrl: { type: String, required: true },
    thumbPublicId: { type: String, required: true },
    width: { type: Number, required: true },
    height: { type: Number, required: true },
    altText: {
      type: String,
      trim: true,
      default: "",
      maxlength: POST_LIMITS.ALT_TEXT_MAX_LENGTH,
    },
  },
  { _id: true },
);

const postSchema = new mongoose.Schema(
  {
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    media: {
      type: [postMediaSchema],
      validate: {
        validator: (items) =>
          items.length >= 1 && items.length <= POST_LIMITS.MAX_MEDIA,
        message: `A post needs 1 to ${POST_LIMITS.MAX_MEDIA} images`,
      },
    },

    aspectRatio: {
      type: Number,
      required: true,
      enum: Object.values(POST_ASPECT_RATIOS),
    },

    caption: {
      type: String,
      trim: true,
      default: "",
      maxlength: POST_LIMITS.CAPTION_MAX_LENGTH,
    },

    hashtags: { type: [String], default: [] },
    mentions: { type: [String], default: [] },

    location: {
      type: String,
      trim: true,
      default: "",
      maxlength: POST_LIMITS.LOCATION_MAX_LENGTH,
    },

    likeCount: { type: Number, default: 0, min: 0 },
    commentCount: { type: Number, default: 0, min: 0 },
    hideLikeCount: { type: Boolean, default: false },
    commentsDisabled: { type: Boolean, default: false },

    // Sent by the app so a retried create returns the same post instead of a duplicate
    clientRequestId: { type: String, default: null },
  },
  { timestamps: true },
);

postSchema.index({ author: 1, createdAt: -1, _id: -1 });
postSchema.index(
  { author: 1, clientRequestId: 1 },
  { unique: true, partialFilterExpression: { clientRequestId: { $type: "string" } } },
);

const Post = mongoose.model("Post", postSchema);

export default Post;
