import { describe, expect, it } from "vitest";
import { parseEnv } from "../src/config/env.js";

const validEnv = {
  NODE_ENV: "test",
  CORS_ALLOWED_ORIGINS: "http://localhost:5173",
  FIREBASE_PROJECT_ID: "demo-freelanso-test",
};

describe("environment validation", () => {
  it("requires a Firebase project ID and gives a clear message", () => {
    expect(() => parseEnv({ ...validEnv, FIREBASE_PROJECT_ID: "" })).toThrow(
      /Invalid environment configuration:.*FIREBASE_PROJECT_ID/s,
    );
  });

  it("rejects wildcard CORS and incomplete external-service credentials", () => {
    expect(() => parseEnv({ ...validEnv, CORS_ALLOWED_ORIGINS: "*" })).toThrow(
      /wildcards are not allowed/,
    );
    expect(() => parseEnv({ ...validEnv, AI_PROVIDER: "provider" })).toThrow(
      /AI_PROVIDER, AI_MODEL, and AI_API_KEY/,
    );
    expect(() =>
      parseEnv({
        ...validEnv,
        CLOUDINARY_CLOUD_NAME: "test-cloud",
        CLOUDINARY_API_KEY: "test-key",
        CLOUDINARY_API_SECRET: "test-secret",
      }),
    ).toThrow(/CLOUDINARY_PROFILE_UPLOAD_PRESET/);
  });

  it("parses defaults and comma-separated origins", () => {
    expect(
      parseEnv({
        ...validEnv,
        CORS_ALLOWED_ORIGINS:
          "http://localhost:5173, https://freelanso.example",
      }),
    ).toMatchObject({
      port: 5000,
      trustProxy: false,
      corsAllowedOrigins: [
        "http://localhost:5173",
        "https://freelanso.example",
      ],
    });
  });

  it("treats false emulator host values as disabled", () => {
    expect(
      parseEnv({
        ...validEnv,
        FIRESTORE_EMULATOR_HOST: "false",
        FIREBASE_AUTH_EMULATOR_HOST: "false",
        FIREBASE_DATABASE_EMULATOR_HOST: "false",
      }),
    ).toMatchObject({
      firestoreEmulatorHost: undefined,
      firebaseAuthEmulatorHost: undefined,
      firebaseDatabaseEmulatorHost: undefined,
    });
  });

  it("rejects a withdrawal range whose maximum is below its minimum", () => {
    expect(() =>
      parseEnv({
        ...validEnv,
        WITHDRAWAL_MIN_MINOR: "20000",
        WITHDRAWAL_MAX_MINOR: "10000",
      }),
    ).toThrow(/WITHDRAWAL_MAX_MINOR/);
  });
});
