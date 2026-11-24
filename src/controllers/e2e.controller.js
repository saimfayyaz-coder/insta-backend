import ApiResponse from "../utils/ApiResponse.js";
import { ErrorCodes } from "../utils/ErrorCodes.js";
import {
  normalizeRunId,
  createRunUser,
  deleteRunUsers,
  deleteStaleRunUsers,
} from "../services/e2e.service.js";

const fail = (res, status, message, code) =>
  res.status(status).json(new ApiResponse(false, message, null, null, code));

// POST /api/test/users  { runId, withPost? }  → a fresh logged-out user with its password
export const createTestUser = async (req, res) => {
  try {
    const runId = normalizeRunId(req.body?.runId);
    if (!runId) {
      return fail(res, 400, "runId is required", ErrorCodes.VALIDATION_FAILED);
    }

    const user = await createRunUser(runId, { withPost: req.body?.withPost === true });
    return res.status(201).json(new ApiResponse(true, "Test user created", { user }));
  } catch (error) {
    console.error("Create test user error:", error);
    return fail(res, 500, "Failed to create test user", ErrorCodes.SERVER_ERROR);
  }
};

// DELETE /api/test/runs/:runId  → removes every user of that run and their data
export const deleteTestRun = async (req, res) => {
  try {
    const runId = normalizeRunId(req.params.runId);
    if (!runId) {
      return fail(res, 400, "runId is required", ErrorCodes.VALIDATION_FAILED);
    }

    const deletedUsers = await deleteRunUsers(runId);
    return res.status(200).json(new ApiResponse(true, "Test run deleted", { deletedUsers }));
  } catch (error) {
    console.error("Delete test run error:", error);
    return fail(res, 500, "Failed to delete test run", ErrorCodes.SERVER_ERROR);
  }
};

// DELETE /api/test/runs/stale  → removes users left by runs that crashed before cleanup
export const deleteStaleTestRuns = async (req, res) => {
  try {
    const deletedUsers = await deleteStaleRunUsers();
    return res.status(200).json(new ApiResponse(true, "Stale test runs deleted", { deletedUsers }));
  } catch (error) {
    console.error("Delete stale test runs error:", error);
    return fail(res, 500, "Failed to delete stale test runs", ErrorCodes.SERVER_ERROR);
  }
};
