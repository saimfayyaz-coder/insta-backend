// Seeds the E2E test database with known users, each with one post.
// Run: npm run seed:e2e   (loads .env.test, never .env)
//
// Safety: refuses to run unless NODE_ENV=test AND the database name ends with "_e2e",
// so it can never touch the dev or production database.
import "dotenv/config";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import User from "../src/models/User.js";
import {
  E2E_CONFIG,
  createSeedPost,
  resetUserContent,
} from "../src/services/e2e.service.js";

// Fixed account for logging in by hand during local testing.
// Automated tests don't use it: they create their own users through the test API (/api/test).
const buildSeedUsers = (password) => [
  {
    username: "e2e_user01",
    email: "e2e_user01@example.com",
    name: "E2E User 01",
    password,
    isVerified: true,
  },
];

const fail = (message) => {
  console.error(`[seed:e2e] ABORTED: ${message}`);
  process.exit(1);
};

const run = async () => {
  if (process.env.NODE_ENV !== "test") {
    fail(`NODE_ENV must be "test" (got "${process.env.NODE_ENV}"). Use: npm run seed:e2e`);
  }
  if (!process.env.MONGODB_URI) fail("MONGODB_URI is not set. Create .env.test from .env.test.example");
  if (!process.env.E2E_USER_PASSWORD) fail("E2E_USER_PASSWORD is not set in .env.test");

  await mongoose.connect(process.env.MONGODB_URI);
  const dbName = mongoose.connection.name;

  if (!dbName.endsWith(E2E_CONFIG.REQUIRED_DB_SUFFIX)) {
    await mongoose.disconnect();
    fail(`database "${dbName}" does not end with "${E2E_CONFIG.REQUIRED_DB_SUFFIX}". Refusing to seed.`);
  }

  console.log(`[seed:e2e] Database: ${dbName}`);

  const hashedPassword = await bcrypt.hash(process.env.E2E_USER_PASSWORD, 12);

  for (const seedUser of buildSeedUsers(hashedPassword)) {
    // Upsert + full reset: the user always ends up in exactly this state,
    // whatever earlier test runs changed (bio, avatar, tokens...).
    const user = await User.findOneAndUpdate(
      { username: seedUser.username },
      {
        $set: {
          ...seedUser,
          bio: "",
          website: "",
          links: [],
          gender: "prefer_not_to_say",
          avatar: { url: null, publicId: null },
          otp: { code: null, expiresAt: null },
          refreshToken: null,
          deviceToken: null,
          postsCount: 1,
          followersCount: 0,
          followingCount: 0,
        },
      },
      { upsert: true, returnDocument: "after", runValidators: true, setDefaultsOnInsert: true },
    );

    await resetUserContent(user._id);
    await createSeedPost(user);
    console.log(`[seed:e2e] Ready: ${seedUser.username} (1 post, no follows)`);
  }

  await mongoose.disconnect();
  console.log("[seed:e2e] Done");
};

run().catch(async (error) => {
  console.error("[seed:e2e] Failed:", error.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
