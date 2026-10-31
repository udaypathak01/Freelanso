import { asyncHandler } from "../../utils/asyncHandler.js";
import { ok } from "../../utils/response.js";
import { getDashboard } from "./dashboard.service.js";

export const getDashboardHandler = asyncHandler(async (req, res) =>
  ok(res, await getDashboard(req.user.uid, req.validated.query)),
);
