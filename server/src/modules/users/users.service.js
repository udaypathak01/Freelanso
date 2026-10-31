import { auth } from "../../config/firebase.js";
import { env } from "../../config/env.js";
import { logger } from "../../config/logger.js";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ServiceUnavailableError,
} from "../../utils/AppError.js";
import {
  assignProfileRoleOnce,
  ensureUserProfile,
  findUserProfile,
  setProfileRole,
  updateUserProfile,
} from "./users.repository.js";

const validRoles = new Set(["freelancer", "client", "admin"]);

function cloudinaryPhotoUrl(value) {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      url.hostname === "res.cloudinary.com" &&
      url.pathname.startsWith(`/${env.cloudinaryCloudName}/image/upload/`)
    );
  } catch {
    return false;
  }
}

function identityFromFirebaseUser(user) {
  return {
    uid: user.uid,
    email: user.email ?? null,
    displayName: user.displayName ?? "",
    photoURL: user.photoURL ?? null,
    role: validRoles.has(user.customClaims?.role)
      ? user.customClaims.role
      : null,
  };
}

export async function getMyProfile(identity) {
  const profile = await ensureUserProfile(identity);
  return profile;
}

export async function getPublicProfile(uid) {
  const profile = await findUserProfile(uid);
  if (!profile) throw new NotFoundError("User profile not found");
  return profile;
}

export async function updateProfile(actor, targetUid, updates, requestId) {
  if (actor.uid !== targetUid && actor.role !== "admin") {
    logger.warn(
      {
        requestId,
        uid: actor.uid,
        targetUid,
        authorizationFailure: true,
      },
      "Profile update denied",
    );
    throw new ForbiddenError();
  }

  await ensureUserProfile(actor);
  if (updates.photoURL) {
    const firebaseUser = await auth.getUser(targetUid);
    if (
      !cloudinaryPhotoUrl(updates.photoURL) &&
      updates.photoURL !== firebaseUser.photoURL
    ) {
      throw new ForbiddenError(
        "Profile photos must come from approved sources",
      );
    }
  }
  if (updates.bannerURL) {
    let url;
    try {
      url = new URL(updates.bannerURL);
    } catch {
      throw new ForbiddenError(
        "Profile banners must come from approved sources",
      );
    }
    if (
      url.hostname !== "images.unsplash.com" &&
      !cloudinaryPhotoUrl(updates.bannerURL)
    ) {
      throw new ForbiddenError(
        "Profile banners must come from approved sources",
      );
    }
  }

  const updated = await updateUserProfile(targetUid, updates);
  if (!updated) throw new NotFoundError("User profile not found");
  return updated;
}

export async function onboardUserRole(identity, requestedRole) {
  await ensureUserProfile(identity);
  const firebaseUser = await auth.getUser(identity.uid);
  const currentRole = validRoles.has(firebaseUser.customClaims?.role)
    ? firebaseUser.customClaims.role
    : null;
  if (currentRole && currentRole !== requestedRole) {
    await setProfileRole(identity.uid, currentRole);
    throw new ConflictError("Account role has already been assigned");
  }

  const assignedRole = await assignProfileRoleOnce(identity.uid, requestedRole);
  if (assignedRole !== requestedRole) {
    throw new ConflictError("Account role has already been assigned");
  }

  if (currentRole !== requestedRole) {
    try {
      await auth.setCustomUserClaims(identity.uid, {
        ...firebaseUser.customClaims,
        role: requestedRole,
      });
    } catch {
      throw new ServiceUnavailableError(
        "Unable to assign account role; retry the request",
      );
    }
  }

  await setProfileRole(identity.uid, requestedRole);
  return { role: requestedRole };
}

export async function assignAdminRole(uid, role) {
  const user = await auth.getUser(uid);
  await ensureUserProfile(identityFromFirebaseUser(user));
  await auth.setCustomUserClaims(uid, { ...user.customClaims, role });
  await setProfileRole(uid, role);
}
