import express from "express";
import { requireE2eToken, requireE2eDatabase } from "../middlewares/e2e.middleware.js";
import {
  createTestUser,
  deleteTestRun,
  deleteStaleTestRuns,
} from "../controllers/e2e.controller.js";

// Test-data API for E2E runs. Mounted only when E2E_TEST_API_ENABLED=true (see app.js).
const router = express.Router();

router.use(requireE2eToken, requireE2eDatabase);

router.post("/users", createTestUser);

// Before /runs/:runId so "stale" is not read as a run id
router.delete("/runs/stale", deleteStaleTestRuns);

router.delete("/runs/:runId", deleteTestRun);

export default router;
