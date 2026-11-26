/**
 * Structured error codes emitted by the server.
 * The client maps these directly to TRANSLATION_KEYS for i18n.
 *
 * Contract: errors.${ErrorCodes.X} must exist in every locale file on the client.
 */
export const ErrorCodes = {
  INVALID_CREDENTIALS:    'INVALID_CREDENTIALS',
  INCORRECT_PASSWORD:     'INCORRECT_PASSWORD',
  EMAIL_ALREADY_EXISTS:   'EMAIL_ALREADY_EXISTS',
  USERNAME_ALREADY_EXISTS:'USERNAME_ALREADY_EXISTS',// Signup with taken username
  USERNAME_REQUIRED:      'USERNAME_REQUIRED',      // Username missing
  INVALID_USERNAME:       'INVALID_USERNAME',       // Username format invalid
  EMAIL_NOT_VERIFIED:     'EMAIL_NOT_VERIFIED',     // User has not verified OTP
  INVALID_OTP:            'INVALID_OTP',            // OTP code is incorrect
  OTP_EXPIRED:            'OTP_EXPIRED',            // OTP code has expired
  USER_NOT_FOUND:         'USER_NOT_FOUND',          // User deleted mid-session
  VALIDATION_FAILED:      'VALIDATION_FAILED',       // Request body invalid
  DEVICE_TOKEN_REQUIRED:  'DEVICE_TOKEN_REQUIRED',   // Push token missing

  // ─── Auth Tokens ──────────────────────────────────────────────────────────
  TOKEN_REQUIRED:          'TOKEN_REQUIRED',          // No Authorization header
  TOKEN_EXPIRED:           'TOKEN_EXPIRED',           // JWT access token expired
  TOKEN_INVALID:           'TOKEN_INVALID',           // JWT malformed/invalid
  REFRESH_TOKEN_REQUIRED:  'REFRESH_TOKEN_REQUIRED',  // No refresh token in body
  REFRESH_TOKEN_INVALID:   'REFRESH_TOKEN_INVALID',   // Refresh token mismatch
  REFRESH_TOKEN_EXPIRED:   'REFRESH_TOKEN_EXPIRED',   // Refresh token expired
  INVALID_RESET_TOKEN:     'INVALID_RESET_TOKEN',     // Password reset token expired or invalid


  // ─── Posts & Media ────────────────────────────────────────────────────────
  POST_MEDIA_REQUIRED:     'POST_MEDIA_REQUIRED',     // Post has no images
  POST_TOO_MANY_MEDIA:     'POST_TOO_MANY_MEDIA',     // More images than allowed
  CAPTION_TOO_LONG:        'CAPTION_TOO_LONG',        // Caption over the length limit
  TOO_MANY_HASHTAGS:       'TOO_MANY_HASHTAGS',       // Caption has too many #tags
  TOO_MANY_MENTIONS:       'TOO_MANY_MENTIONS',       // Caption has too many @mentions
  INVALID_ASPECT_RATIO:    'INVALID_ASPECT_RATIO',    // Not 1:1, 4:5 or 1.91:1
  MEDIA_NOT_FOUND:         'MEDIA_NOT_FOUND',         // Media missing, not owned, or already used
  INVALID_IMAGE:           'INVALID_IMAGE',           // Not an image or cannot be decoded
  FILE_TOO_LARGE:          'FILE_TOO_LARGE',          // Upload over the size limit
  UPLOAD_FAILED:           'UPLOAD_FAILED',           // Image storage failed
  POST_NOT_FOUND:          'POST_NOT_FOUND',          // Post missing or deleted
  COMMENT_NOT_FOUND:       'COMMENT_NOT_FOUND',       // Comment missing or deleted
  COMMENT_REQUIRED:        'COMMENT_REQUIRED',        // Comment text is empty
  COMMENT_TOO_LONG:        'COMMENT_TOO_LONG',        // Comment text over the length limit
  COMMENTS_DISABLED:       'COMMENTS_DISABLED',       // Post author disabled comments
  FORBIDDEN:               'FORBIDDEN',               // Not allowed to touch this resource
  RATE_LIMITED:            'RATE_LIMITED',            // Too many uploads or posts

  // ─── Follows ──────────────────────────────────────────────────────────────
  CANNOT_FOLLOW_SELF:      'CANNOT_FOLLOW_SELF',      // Following your own account

  // ─── Generic ──────────────────────────────────────────────────────────────
  SERVER_ERROR:            'SERVER_ERROR',            // Unhandled 500
};
