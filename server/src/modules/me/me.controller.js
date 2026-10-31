import { asyncHandler } from "../../utils/asyncHandler.js";
import { ok } from "../../utils/response.js";
import { getCurrentUserDto } from "./me.service.js";

export const getMe = asyncHandler(async (req, res) =>
  ok(res, await getCurrentUserDto(req.user)),
);
