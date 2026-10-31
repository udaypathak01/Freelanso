import dotenv from "dotenv";
import { z } from "zod";

if (process.env.NODE_ENV !== "test" && !process.env.FIREBASE_PROJECT_ID) {
  dotenv.config();
}

for (const name of [
  "FIRESTORE_EMULATOR_HOST",
  "FIREBASE_AUTH_EMULATOR_HOST",
  "FIREBASE_DATABASE_EMULATOR_HOST",
]) {
  if (process.env[name]?.trim().toLowerCase() === "false") {
    delete process.env[name];
  }
}

const emptyToUndefined = (value) => (value === "" ? undefined : value);
const emptyEmulatorHostToUndefined = (value) => {
  if (typeof value !== "string") return value;
  const host = value.trim();
  return !host || host.toLowerCase() === "false" ? undefined : host;
};

const schema = z
  .object({
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    RENDER: z.preprocess(emptyToUndefined, z.string().optional()),
    PORT: z.coerce.number().int().min(1).max(65535).default(5000),
    CORS_ALLOWED_ORIGINS: z
      .string()
      .trim()
      .min(1)
      .transform((value) =>
        value
          .split(",")
          .map((origin) => origin.trim())
          .filter(Boolean),
      ),
    FIREBASE_PROJECT_ID: z.string().trim().min(1),
    FIREBASE_DATABASE_URL: z.preprocess(
      emptyToUndefined,
      z.string().url().optional(),
    ),
    GOOGLE_APPLICATION_CREDENTIALS: z.preprocess(
      emptyToUndefined,
      z.string().trim().min(1).optional(),
    ),
    CLOUDINARY_CLOUD_NAME: z.preprocess(
      emptyToUndefined,
      z.string().trim().min(1).optional(),
    ),
    CLOUDINARY_API_KEY: z.preprocess(
      emptyToUndefined,
      z.string().trim().min(1).optional(),
    ),
    CLOUDINARY_API_SECRET: z.preprocess(
      emptyToUndefined,
      z.string().trim().min(1).optional(),
    ),
    CLOUDINARY_PROFILE_UPLOAD_PRESET: z.preprocess(
      emptyToUndefined,
      z.string().trim().min(1).optional(),
    ),
    CLOUDINARY_PROJECT_UPLOAD_PRESET: z.preprocess(
      emptyToUndefined,
      z.string().trim().min(1).optional(),
    ),
    CLOUDINARY_BATTLE_UPLOAD_PRESET: z.preprocess(
      emptyToUndefined,
      z.string().trim().min(1).optional(),
    ),
    AI_PROVIDER: z.preprocess(
      emptyToUndefined,
      z.string().trim().min(1).optional(),
    ),
    AI_API_KEY: z.preprocess(
      emptyToUndefined,
      z.string().trim().min(1).optional(),
    ),
    AI_MODEL: z.preprocess(
      emptyToUndefined,
      z.string().trim().min(1).max(100).optional(),
    ),
    LOG_LEVEL: z
      .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
      .default("info"),
    RATE_LIMIT_WINDOW_MS: z.coerce.number().int().min(1000).default(900000),
    RATE_LIMIT_MAX: z.coerce.number().int().min(1).default(120),
    TRUST_PROXY: z
      .string()
      .default("false")
      .transform((value, context) => {
        if (value === "true") return true;
        if (value === "false") return false;
        if (/^\d+$/.test(value) && Number.isSafeInteger(Number(value)))
          return Number(value);
        context.addIssue({
          code: "custom",
          message:
            "TRUST_PROXY must be true, false, or a non-negative hop count",
        });
        return z.NEVER;
      }),
    REQUEST_TIMEOUT_MS: z.coerce.number().int().min(1000).default(30000),
    FIRESTORE_EMULATOR_HOST: z.preprocess(
      emptyEmulatorHostToUndefined,
      z.string().trim().min(1).optional(),
    ),
    FIREBASE_AUTH_EMULATOR_HOST: z.preprocess(
      emptyEmulatorHostToUndefined,
      z.string().trim().min(1).optional(),
    ),
    FIREBASE_DATABASE_EMULATOR_HOST: z.preprocess(
      emptyEmulatorHostToUndefined,
      z.string().trim().min(1).optional(),
    ),
    WITHDRAWAL_MIN_MINOR: z.coerce.number().int().positive().default(10000),
    WITHDRAWAL_MAX_MINOR: z.coerce.number().int().positive().default(1000000),
    WALLET_CURRENCY: z.string().trim().length(3).default("INR"),
  })
  .superRefine((config, context) => {
    if (config.WITHDRAWAL_MAX_MINOR < config.WITHDRAWAL_MIN_MINOR) {
      context.addIssue({
        code: "custom",
        path: ["WITHDRAWAL_MAX_MINOR"],
        message: "must be greater than or equal to WITHDRAWAL_MIN_MINOR",
      });
    }
    const origins = config.CORS_ALLOWED_ORIGINS;
    if (
      origins.length === 0 ||
      origins.some(
        (origin) => origin === "*" || !/^https?:\/\/[^/]+$/.test(origin),
      )
    ) {
      context.addIssue({
        code: "custom",
        path: ["CORS_ALLOWED_ORIGINS"],
        message:
          "must be a comma-separated allow-list of HTTP(S) origins; wildcards are not allowed",
      });
    }
    if (
      config.NODE_ENV === "production" &&
      origins.some((origin) => !origin.startsWith("https://"))
    ) {
      context.addIssue({
        code: "custom",
        path: ["CORS_ALLOWED_ORIGINS"],
        message: "production origins must use HTTPS",
      });
    }

    const cloudinaryValues = [
      config.CLOUDINARY_CLOUD_NAME,
      config.CLOUDINARY_API_KEY,
      config.CLOUDINARY_API_SECRET,
      config.CLOUDINARY_PROFILE_UPLOAD_PRESET,
      config.CLOUDINARY_PROJECT_UPLOAD_PRESET,
    ];
    if (cloudinaryValues.some(Boolean) && !cloudinaryValues.every(Boolean)) {
      context.addIssue({
        code: "custom",
        path: ["CLOUDINARY_API_SECRET"],
        message:
          "CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET, CLOUDINARY_PROFILE_UPLOAD_PRESET, and CLOUDINARY_PROJECT_UPLOAD_PRESET must be configured together",
      });
    }

    if (
      Boolean(config.AI_PROVIDER) !== Boolean(config.AI_API_KEY) ||
      Boolean(config.AI_PROVIDER) !== Boolean(config.AI_MODEL)
    ) {
      context.addIssue({
        code: "custom",
        path: ["AI_PROVIDER"],
        message:
          "AI_PROVIDER, AI_MODEL, and AI_API_KEY must be configured together",
      });
    }
    if (config.AI_PROVIDER && config.AI_PROVIDER !== "gemini") {
      context.addIssue({
        code: "custom",
        path: ["AI_PROVIDER"],
        message: "Only the Gemini AI provider is supported",
      });
    }
  });

export function parseEnv(input) {
  const result = schema.safeParse({
    ...input,
    TRUST_PROXY:
      input.TRUST_PROXY ?? (input.RENDER === "true" ? "1" : undefined),
  });
  if (!result.success) {
    const issues = result.error.issues
      .map(
        ({ path, message }) =>
          `- ${path.join(".") || "environment"}: ${message}`,
      )
      .join("\n");
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return {
    nodeEnv: result.data.NODE_ENV,
    port: result.data.PORT,
    corsAllowedOrigins: result.data.CORS_ALLOWED_ORIGINS,
    firebaseProjectId: result.data.FIREBASE_PROJECT_ID,
    firebaseDatabaseUrl:
      result.data.FIREBASE_DATABASE_URL ??
      `https://${result.data.FIREBASE_PROJECT_ID}-default-rtdb.firebaseio.com`,
    googleApplicationCredentials: result.data.GOOGLE_APPLICATION_CREDENTIALS,
    cloudinaryCloudName: result.data.CLOUDINARY_CLOUD_NAME,
    cloudinaryApiKey: result.data.CLOUDINARY_API_KEY,
    cloudinaryApiSecret: result.data.CLOUDINARY_API_SECRET,
    cloudinaryProfileUploadPreset: result.data.CLOUDINARY_PROFILE_UPLOAD_PRESET,
    cloudinaryProjectUploadPreset: result.data.CLOUDINARY_PROJECT_UPLOAD_PRESET,
    cloudinaryBattleUploadPreset: result.data.CLOUDINARY_BATTLE_UPLOAD_PRESET,
    aiProvider: result.data.AI_PROVIDER,
    aiModel: result.data.AI_MODEL,
    aiApiKey: result.data.AI_API_KEY,
    logLevel: result.data.LOG_LEVEL,
    rateLimitWindowMs: result.data.RATE_LIMIT_WINDOW_MS,
    rateLimitMax: result.data.RATE_LIMIT_MAX,
    trustProxy: result.data.TRUST_PROXY,
    requestTimeoutMs: result.data.REQUEST_TIMEOUT_MS,
    firestoreEmulatorHost: result.data.FIRESTORE_EMULATOR_HOST,
    firebaseAuthEmulatorHost: result.data.FIREBASE_AUTH_EMULATOR_HOST,
    firebaseDatabaseEmulatorHost:
      result.data.FIREBASE_DATABASE_EMULATOR_HOST,
    withdrawalMinMinor: result.data.WITHDRAWAL_MIN_MINOR,
    withdrawalMaxMinor: result.data.WITHDRAWAL_MAX_MINOR,
    walletCurrency: result.data.WALLET_CURRENCY.toUpperCase(),
  };
}

export const env = parseEnv(process.env);
