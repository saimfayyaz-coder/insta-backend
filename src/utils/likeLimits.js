export const LIKE_LIMITS = {
  PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 50,
  // Like and unlike requests one user may send per window; far above normal scrolling
  MAX_TOGGLES_PER_WINDOW: 60,
  TOGGLE_WINDOW_MS: 60 * 1000,
  // Liking the same post again inside this window sends no second push
  NOTIFICATION_DEDUPE_MS: 24 * 60 * 60 * 1000,
};

export const NOTIFICATION_TYPES = {
  POST_LIKE: "post_like",
};
