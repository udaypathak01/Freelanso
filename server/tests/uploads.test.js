import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { env } from "../src/config/env.js";
import {
  createProfileUploadSignature,
  createProjectUploadSignature,
} from "../src/modules/uploads/uploads.service.js";
import { ServiceUnavailableError } from "../src/utils/AppError.js";

describe("profile upload signing", () => {
  it("signs the preset and restricted per-user asset folder", () => {
    const signature = createProfileUploadSignature("user-1", 1_800_000_000_000);
    const parameters =
      "asset_folder=users/user-1/profile&timestamp=1800000000&upload_preset=test-signed-profile";
    const expected = createHash("sha1")
      .update(`${parameters}test-api-secret`)
      .digest("hex");

    expect(signature).toMatchObject({
      cloudName: "test-cloud",
      apiKey: "test-api-key",
      timestamp: 1_800_000_000,
      assetFolder: "users/user-1/profile",
      uploadPreset: "test-signed-profile",
      allowedFormats: "gif,jpg,png,webp",
      maxFileSize: 5 * 1024 * 1024,
      signature: expected,
    });
    expect(signature).not.toHaveProperty("apiSecret");
  });

  it("fails explicitly when Cloudinary is not configured", () => {
    const original = env.cloudinaryApiSecret;
    env.cloudinaryApiSecret = undefined;
    try {
      expect(() => createProfileUploadSignature("user-1")).toThrow(
        ServiceUnavailableError,
      );
    } finally {
      env.cloudinaryApiSecret = original;
    }
  });

  it("signs project media into the authenticated user's restricted project folder", () => {
    const signature = createProjectUploadSignature("user-1", "video");
    const parameters =
      "asset_folder=users/user-1/projects&timestamp=" +
      signature.timestamp +
      "&upload_preset=test-signed-project";
    const expected = createHash("sha1")
      .update(`${parameters}test-api-secret`)
      .digest("hex");

    expect(signature).toMatchObject({
      cloudName: "test-cloud",
      apiKey: "test-api-key",
      assetFolder: "users/user-1/projects",
      uploadPreset: "test-signed-project",
      resourceType: "video",
      allowedFormats: "mp4,mov,webm",
      maxFileSize: 100 * 1024 * 1024,
      signature: expected,
    });
    expect(signature).not.toHaveProperty("apiSecret");
  });
});
