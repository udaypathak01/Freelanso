import { asyncHandler } from "../../utils/asyncHandler.js";
import { ok } from "../../utils/response.js";
import { scoreProjectMatches } from "./matches.service.js";

export const postScoreAllMatches = asyncHandler(async (req, res) => {
  const result = await scoreProjectMatches(
    req.user,
    req.validated.body.projectId,
  );
  return ok(res, result.matches, {
    candidateCount: result.candidateCount,
    degraded: false,
  });
});
