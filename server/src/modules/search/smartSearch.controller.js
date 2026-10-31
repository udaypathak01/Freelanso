import { asyncHandler } from "../../utils/asyncHandler.js";
import { ok } from "../../utils/response.js";
import { smartSearchService } from "./smartSearch.service.js";

export const postSmartSearch = asyncHandler(async (req, res) => {
  const result = await smartSearchService.search(
    req.user,
    req.validated.body,
    req.id,
  );
  return ok(res, result.items, result.meta);
});
