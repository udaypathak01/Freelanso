import { asyncHandler } from "../../utils/asyncHandler.js";
import { ok } from "../../utils/response.js";
import { checkReadiness } from "./health.service.js";

export function getLiveness(req, res) {
  return ok(res, { status: "ok" });
}

export const getReadiness = asyncHandler(async (req, res) => {
  try {
    await checkReadiness();
  } catch (error) {
    req.log?.error(
      { requestId: req.id, readinessFailure: true },
      "Firestore readiness check failed",
    );
    throw error;
  }
  return ok(res, { status: "ready" });
});
