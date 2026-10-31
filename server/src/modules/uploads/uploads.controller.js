import { asyncHandler } from "../../utils/asyncHandler.js";
import { ok } from "../../utils/response.js";
import {
  createProfileUploadSignature,
  createProjectUploadSignature,
  createBattleUploadSignature,
} from "./uploads.service.js";

export const signUpload = asyncHandler(async (req, res) => {
  const { purpose, resourceType } = req.validated.body;
  const signature =
    purpose === "project"
      ? createProjectUploadSignature(req.user.uid, resourceType)
      : purpose === "battle"
        ? createBattleUploadSignature(req.user.uid)
        : createProfileUploadSignature(req.user.uid);
  return ok(res, signature);
});
