export const COMMENT_LIMITS = {
  MAX_LENGTH: 2200,
  MAX_MENTIONS: 20,
  PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 50,
  CLIENT_REQUEST_ID_MAX_LENGTH: 64,
  NOTIFICATION_PREVIEW_LENGTH: 80,
  // Comments one user may create per window; guards against spam bursts
  MAX_COMMENTS_PER_WINDOW: 20,
  WINDOW_MS: 60 * 1000,
};

export const COMMENT_NOTIFICATION_TYPES = {
  POST_COMMENT: "post_comment",
};
