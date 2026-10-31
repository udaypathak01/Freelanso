import { asyncHandler } from "../../utils/asyncHandler.js";
import { created, ok } from "../../utils/response.js";
import {
  getMyProfile,
  getPublicProfile,
  onboardUserRole,
  updateProfile,
} from "./users.service.js";
import { toPrivateUserDto, toPublicUserDto } from "./users.mapper.js";

export const getMe = asyncHandler(async (req, res) => {
  const profile = await getMyProfile(req.user);
  return ok(res, toPrivateUserDto(req.user.uid, profile));
});

export const getPublic = asyncHandler(async (req, res) => {
  const { uid } = req.validated.params;
  const profile = await getPublicProfile(uid);
  return ok(res, toPublicUserDto(uid, profile));
});

export const putProfile = asyncHandler(async (req, res) => {
  const { uid } = req.validated.params;
  const profile = await updateProfile(
    req.user,
    uid,
    req.validated.body,
    req.id,
  );
  return ok(res, toPrivateUserDto(uid, profile));
});

export const onboardRole = asyncHandler(async (req, res) => {
  const result = await onboardUserRole(req.user, req.validated.body.role);
  req.log?.info(
    { requestId: req.id, uid: req.user.uid, role: result.role },
    "Initial user role assigned",
  );
  return created(res, result);
});
