import { createHash } from "node:crypto";
import { env } from "../../config/env.js";
import { ServiceUnavailableError } from "../../utils/AppError.js";

export const PROFILE_UPLOAD_FORMATS = ["gif", "jpg", "png", "webp"];
export const PROFILE_UPLOAD_MAX_BYTES = 5 * 1024 * 1024;
export const PROJECT_UPLOAD_FORMATS = {
  image: ["jpg", "png", "webp"],
  video: ["mp4", "mov", "webm"],
};
export const PROJECT_UPLOAD_MAX_BYTES = 100 * 1024 * 1024;
export const BATTLE_UPLOAD_FORMATS = ["jpg", "png", "webp"];
export const BATTLE_UPLOAD_MAX_BYTES = 5 * 1024 * 1024;

function uploadSignature({
  folder,
  preset,
  timestamp = Math.floor(Date.now() / 1000),
}) {
  const signatureParams = {
    asset_folder: folder,
    timestamp,
    upload_preset: preset,
  };
  const canonical = Object.entries(signatureParams)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join("&");
  return {
    cloudName: env.cloudinaryCloudName,
    apiKey: env.cloudinaryApiKey,
    timestamp,
    assetFolder: folder,
    uploadPreset: preset,
    signature: createHash("sha1")
      .update(`${canonical}${env.cloudinaryApiSecret}`)
      .digest("hex"),
  };
}

export function createProfileUploadSignature(uid, now = Date.now()) {
  if (
    !env.cloudinaryCloudName ||
    !env.cloudinaryApiKey ||
    !env.cloudinaryApiSecret ||
    !env.cloudinaryProfileUploadPreset
  ) {
    throw new ServiceUnavailableError("Profile uploads are not configured");
  }

  const assetFolder = `users/${uid}/profile`;
  const allowedFormats = PROFILE_UPLOAD_FORMATS.join(",");
  const signature = uploadSignature({
    folder: assetFolder,
    preset: env.cloudinaryProfileUploadPreset,
    timestamp: Math.floor(now / 1000),
  });
  return {
    ...signature,
    assetFolder,
    allowedFormats,
    maxFileSize: PROFILE_UPLOAD_MAX_BYTES,
  };
}

export function createProjectUploadSignature(uid, resourceType) {
  if (
    !env.cloudinaryCloudName ||
    !env.cloudinaryApiKey ||
    !env.cloudinaryApiSecret ||
    !env.cloudinaryProjectUploadPreset
  ) {
    throw new ServiceUnavailableError("Project uploads are not configured");
  }

  if (!PROJECT_UPLOAD_FORMATS[resourceType]) {
    throw new ServiceUnavailableError("Project upload type is not supported");
  }
  const folder = `users/${uid}/projects`;
  return {
    ...uploadSignature({
      folder,
      preset: env.cloudinaryProjectUploadPreset,
    }),
    resourceType,
    allowedFormats: PROJECT_UPLOAD_FORMATS[resourceType].join(","),
    maxFileSize: PROJECT_UPLOAD_MAX_BYTES,
  };
}

export function createBattleUploadSignature(uid) {
  if (
    !env.cloudinaryCloudName ||
    !env.cloudinaryApiKey ||
    !env.cloudinaryApiSecret ||
    !env.cloudinaryBattleUploadPreset
  ) {
    throw new ServiceUnavailableError("Battle uploads are not configured");
  }
  const assetFolder = `users/${uid}/battles`;
  return {
    ...uploadSignature({
      folder: assetFolder,
      preset: env.cloudinaryBattleUploadPreset,
    }),
    assetFolder,
    resourceType: "image",
    allowedFormats: BATTLE_UPLOAD_FORMATS.join(","),
    maxFileSize: BATTLE_UPLOAD_MAX_BYTES,
  };
}
