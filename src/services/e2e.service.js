// Test data helpers for E2E runs, shared by the test API (routes/e2e.routes.js) and scripts/seed-e2e.js.
// Nothing here is reachable in production: the test API is only mounted when E2E_TEST_API_ENABLED=true.
import crypto from "crypto";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import User from "../models/User.js";
import Post from "../models/Post.js";
import Media from "../models/Media.js";
import Follow from "../models/Follow.js";
import Notification from "../models/Notification.js";
import Location from "../models/Location.js";
import SavedLocation from "../models/SavedLocation.js";
import { MEDIA_STATUS, POST_ASPECT_RATIOS } from "../utils/postLimits.js";

export const E2E_CONFIG = {
  // Test data may only be written to a database whose name ends with this
  REQUIRED_DB_SUFFIX: "_e2e",
  USERNAME_PREFIX: "e2e_",
  RUN_ID_MAX_LENGTH: 12,
  USER_SUFFIX_BYTES: 3,
  PASSWORD_BYTES: 12,
  // Lower than real users (12): test users are throwaway and bcrypt is the slowest step
  BCRYPT_ROUNDS: 8,
  // Users left behind by crashed runs are removed after this long
  STALE_RUN_MS: 24 * 60 * 60 * 1000,
};

// Public Cloudinary demo image, so seeded posts show a real picture without uploading.
// The publicIds are fake on purpose: deleting a seeded post can never remove a real upload.
const SEED_IMAGE = {
  url: "https://res.cloudinary.com/demo/image/upload/w_1080,h_1080,c_fill/sample.jpg",
  thumbUrl: "https://res.cloudinary.com/demo/image/upload/w_480,h_640,c_fill/sample.jpg",
  publicId: "e2e-seed/post",
  thumbPublicId: "e2e-seed/post-thumb",
  width: 1080,
  height: 1080,
};

// Users created by the test API look like e2e_<runId>_<random>; the fixed seed user (e2e_user01) never matches
const RUN_USER_PATTERN = /^e2e_[a-z0-9]+_[a-z0-9]+$/;

export const isE2eDatabase = () =>
  mongoose.connection.name?.endsWith(E2E_CONFIG.REQUIRED_DB_SUFFIX) ?? false;

// Lowercase letters and digits only, so it is safe inside a username and a regex
export const normalizeRunId = (value) =>
  String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(0, E2E_CONFIG.RUN_ID_MAX_LENGTH);

export const createSeedPost = async (user) => {
  const media = await Media.create({
    owner: user._id,
    ...SEED_IMAGE,
    aspectRatio: POST_ASPECT_RATIOS.SQUARE,
    status: MEDIA_STATUS.ATTACHED,
  });

  return Post.create({
    author: user._id,
    media: [{ media: media._id, ...SEED_IMAGE }],
    aspectRatio: POST_ASPECT_RATIOS.SQUARE,
    caption: "Seeded post for E2E tests",
  });
};

// Removes what tests create for a user (posts, uploads, follows) but keeps the account
export const resetUserContent = async (userId) => {
  await Post.deleteMany({ author: userId });
  await Media.deleteMany({ owner: userId });
  await Follow.deleteMany({ $or: [{ follower: userId }, { following: userId }] });
};

// Deletes the accounts and everything that points at them
const deleteUsersWithContent = async (userIds) => {
  if (userIds.length === 0) return 0;

  await Post.deleteMany({ author: { $in: userIds } });
  await Media.deleteMany({ owner: { $in: userIds } });
  await Follow.deleteMany({
    $or: [{ follower: { $in: userIds } }, { following: { $in: userIds } }],
  });
  await Notification.deleteMany({
    $or: [{ recipient: { $in: userIds } }, { sender: { $in: userIds } }],
  });
  await Location.deleteMany({ userId: { $in: userIds } });
  await SavedLocation.deleteMany({ userId: { $in: userIds } });
  const { deletedCount } = await User.deleteMany({ _id: { $in: userIds } });
  return deletedCount;
};

// A fresh, verified user with a random password; optionally with one post so their feed is not empty
export const createRunUser = async (runId, { withPost = false } = {}) => {
  const suffix = crypto.randomBytes(E2E_CONFIG.USER_SUFFIX_BYTES).toString("hex");
  const username = `${E2E_CONFIG.USERNAME_PREFIX}${runId}_${suffix}`;
  const password = crypto.randomBytes(E2E_CONFIG.PASSWORD_BYTES).toString("base64url");

  const user = await User.create({
    username,
    email: `${username}@example.com`,
    name: username,
    password: await bcrypt.hash(password, E2E_CONFIG.BCRYPT_ROUNDS),
    isVerified: true,
    postsCount: withPost ? 1 : 0,
  });

  if (withPost) await createSeedPost(user);

  return { id: user._id.toString(), username, email: user.email, password };
};

export const deleteRunUsers = async (runId) => {
  const users = await User.find({
    username: { $regex: `^${E2E_CONFIG.USERNAME_PREFIX}${runId}_` },
  }).select("_id");
  return deleteUsersWithContent(users.map((user) => user._id));
};

export const deleteStaleRunUsers = async () => {
  const cutoff = new Date(Date.now() - E2E_CONFIG.STALE_RUN_MS);
  const users = await User.find({
    username: { $regex: RUN_USER_PATTERN },
    createdAt: { $lt: cutoff },
  }).select("_id");
  return deleteUsersWithContent(users.map((user) => user._id));
};
