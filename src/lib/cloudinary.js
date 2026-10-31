import { apiRequest } from "./api";

const PROFILE_FORMATS = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
]);
const PROFILE_MAX_BYTES = 5 * 1024 * 1024;
const PROJECT_IMAGE_FORMATS = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);
const PROJECT_VIDEO_FORMATS = new Set([
  "video/mp4",
  "video/quicktime",
  "video/webm",
]);
const PROJECT_MAX_BYTES = 100 * 1024 * 1024;

async function uploadSignedMedia(file, signature) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("api_key", signature.apiKey);
  formData.append("timestamp", String(signature.timestamp));
  formData.append("signature", signature.signature);
  formData.append("upload_preset", signature.uploadPreset);
  formData.append("asset_folder", signature.assetFolder);

  const endpoint = `https://api.cloudinary.com/v1_1/${signature.cloudName}/${signature.resourceType}/upload`;
  const response = await fetch(endpoint, { method: "POST", body: formData });
  const result = await response.json();
  if (!response.ok) {
    throw new Error(
      result.error?.message ||
        `Cloudinary upload failed (HTTP ${response.status})`,
    );
  }
  return result;
}

export const uploadMedia = async (file, purpose = "project") => {
  if (!file) throw new Error("No file provided");

  const isVideo = file.type.startsWith("video/");
  if (purpose === "battle" && isVideo) {
    throw new Error("Battle entries must use an image");
  }
  const resourceType = isVideo ? "video" : "image";
  const allowedTypes = isVideo ? PROJECT_VIDEO_FORMATS : PROJECT_IMAGE_FORMATS;
  if (!allowedTypes.has(file.type)) {
    throw new Error(
      "Use JPG, PNG, or WebP images, or MP4, MOV, or WebM videos",
    );
  }

  const maxBytes = purpose === "battle" ? 5 * 1024 * 1024 : PROJECT_MAX_BYTES;
  if (file.size > maxBytes) {
    throw new Error(
      purpose === "battle"
        ? "Battle images must be 5 MB or smaller"
        : "Project media must be 100 MB or smaller",
    );
  }

  const response = await apiRequest(
    "/uploads/sign",
    {
      method: "POST",
      body: JSON.stringify({ purpose, resourceType }),
    },
    true,
  );
  const signature = response.data;
  const result = await uploadSignedMedia(file, {
    ...signature,
    resourceType,
  });

  return {
    url: result.secure_url,
    publicId: result.public_id,
    mediaType: resourceType,
    resourceType: result.resource_type || resourceType,
    width: result.width,
    height: result.height,
    duration: result.duration,
  };
};

export const uploadImage = async (file) => {
  if (!file) throw new Error("No file provided");
  if (!PROFILE_FORMATS.has(file.type)) {
    throw new Error("Profile photos must be JPG, PNG, GIF or WebP images");
  }
  if (file.size > PROFILE_MAX_BYTES) {
    throw new Error("Profile photos must be 5 MB or smaller");
  }

  const response = await apiRequest(
    "/uploads/sign",
    { method: "POST", body: JSON.stringify({}) },
    true,
  );
  const signature = response.data;
  const result = await uploadSignedMedia(file, {
    ...signature,
    resourceType: "image",
  });
  if (!result.secure_url) throw new Error("Cloudinary upload returned no URL");
  return result.secure_url;
};
