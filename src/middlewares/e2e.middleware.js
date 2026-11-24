import crypto from "crypto";
import ApiResponse from "../utils/ApiResponse.js";
import { ErrorCodes } from "../utils/ErrorCodes.js";
import { isE2eDatabase } from "../services/e2e.service.js";

const E2E_TOKEN_HEADER = "x-e2e-token";

const forbidden = (res, message) =>
  res.status(403).json(new ApiResponse(false, message, null, null, ErrorCodes.FORBIDDEN));

const tokensMatch = (given, expected) => {
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

// Every test API call needs the shared secret from E2E_TEST_TOKEN
export const requireE2eToken = (req, res, next) => {
  const given = req.get(E2E_TOKEN_HEADER) ?? "";
  if (!tokensMatch(given, process.env.E2E_TEST_TOKEN)) {
    return forbidden(res, "Invalid E2E token");
  }
  return next();
};

// Second lock: even with the API enabled, never write test data outside an *_e2e database
export const requireE2eDatabase = (req, res, next) => {
  if (!isE2eDatabase()) {
    return forbidden(res, "Test API only works on an E2E database");
  }
  return next();
};
