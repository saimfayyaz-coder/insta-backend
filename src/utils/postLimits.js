// Mirrors the app's POST_LIMITS; keep both in sync
export const POST_LIMITS = {
  MAX_MEDIA: 10,
  CAPTION_MAX_LENGTH: 2200,
  MAX_HASHTAGS: 30,
  MAX_MENTIONS: 20,
  LOCATION_MAX_LENGTH: 100,
  ALT_TEXT_MAX_LENGTH: 300,
  IMAGE_MAX_BYTES: 8 * 1024 * 1024,
  // Images uploaded but never posted are removed after this long
  PENDING_MEDIA_TTL_MS: 24 * 60 * 60 * 1000,
  MAX_PENDING_MEDIA: 30,
  MAX_POSTS_PER_HOUR: 25,
  PAGE_SIZE: 12,
  MAX_PAGE_SIZE: 30,
};

export const POST_ASPECT_RATIOS = {
  SQUARE: 1,
  PORTRAIT: 0.8,
  LANDSCAPE: 1.91,
};

export const POST_IMAGE = {
  WIDTH: 1080,
  QUALITY: 82,
  // Profile grid tiles are 3:4
  THUMB_WIDTH: 480,
  THUMB_HEIGHT: 640,
  THUMB_QUALITY: 75,
  // Refuse decompression bombs before sharp allocates them
  MAX_INPUT_PIXELS: 50_000_000,
};

export const MEDIA_STATUS = {
  PENDING: "pending",
  ATTACHED: "attached",
};

export const CLOUDINARY_FOLDERS = {
  POSTS: "instagram/posts",
  POST_THUMBS: "instagram/posts/thumbs",
};
