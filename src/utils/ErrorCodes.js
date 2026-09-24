/**
 * Structured error codes emitted by the server.
 * The client maps these directly to TRANSLATION_KEYS for i18n.
 *
 * Contract: errors.${ErrorCodes.X} must exist in every locale file on the client.
 */
export const ErrorCodes = {
  // ─── Auth ─────────────────────────────────────────────────────────────────
  INVALID_CREDENTIALS:    'INVALID_CREDENTIALS',    // Wrong email or password
  EMAIL_ALREADY_EXISTS:   'EMAIL_ALREADY_EXISTS',   // Signup with taken email
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


  // ─── Generic ──────────────────────────────────────────────────────────────
  SERVER_ERROR:            'SERVER_ERROR',            // Unhandled 500
};
