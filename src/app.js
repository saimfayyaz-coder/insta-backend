import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

import authRoutes from "./routes/auth.routes.js";
import locationRoutes from "./routes/location.routes.js";
import notificationRoutes from "./routes/notification.routes.js";
import userRoutes from "./routes/user.routes.js";
import todoRoutes from "./routes/todo.routes.js";
import postRoutes from "./routes/post.routes.js";
import mediaRoutes from "./routes/media.routes.js";
import e2eRoutes from "./routes/e2e.routes.js";

const app = express();

app.use(
  cors({
    origin: true,
    credentials: true,
  }),
);

app.use(express.json());

app.use(cookieParser());
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    console.log(
      req.method,
      req.originalUrl,
      res.statusCode,
      `${Date.now() - start}ms`,
    );
  });
  next();
});
app.use("/api/auth", authRoutes);
app.use("/api/location", locationRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/users", userRoutes);
app.use("/api/todos", todoRoutes);
app.use("/api/posts", postRoutes);
app.use("/api/media", mediaRoutes);

// Test-data API for E2E runs: only on test/staging servers that opt in and set a token.
// Production never sets these, so the routes don't exist there.
if (process.env.E2E_TEST_API_ENABLED === "true" && process.env.E2E_TEST_TOKEN) {
  app.use("/api/test", e2eRoutes);
}

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "PinPoint API is running",
  });
});

export default app;
