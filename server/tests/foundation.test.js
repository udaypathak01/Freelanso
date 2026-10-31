import express from "express";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { app } from "../src/app.js";
import { auth } from "../src/config/firebase.js";
import { firestore } from "../src/config/firebase.js";
import { errorHandler } from "../src/middleware/errorHandler.js";
import { notFound } from "../src/middleware/notFound.js";
import { createRateLimiter } from "../src/middleware/rateLimit.js";
import { requireRole } from "../src/middleware/requireRole.js";
import { requestId } from "../src/middleware/requestId.js";
import { validate } from "../src/middleware/validate.js";
import { ForbiddenError } from "../src/utils/AppError.js";
import { asyncHandler } from "../src/utils/asyncHandler.js";
import {
  decodeCursor,
  encodeCursor,
  parseLimit,
} from "../src/utils/pagination.js";
import { paginated } from "../src/utils/response.js";
import { z } from "zod";

vi.mock("../src/modules/users/users.repository.js", () => ({
  ensureUserProfile: vi.fn(async () => ({})),
  findUserProfile: vi.fn(async () => null),
  updateUserProfile: vi.fn(async () => null),
  assignProfileRoleOnce: vi.fn(async () => null),
  setProfileRole: vi.fn(async () => {}),
}));

afterEach(() => vi.restoreAllMocks());

describe("foundation endpoints", () => {
  it("returns liveness and readiness success envelopes", async () => {
    vi.spyOn(firestore, "listCollections").mockResolvedValue([]);
    await request(app)
      .get("/healthz")
      .expect(200, { success: true, data: { status: "ok" }, meta: {} });
    await request(app)
      .get("/readyz")
      .expect(200, { success: true, data: { status: "ready" }, meta: {} });
  });

  it("returns 503 when Firestore readiness fails", async () => {
    vi.spyOn(firestore, "listCollections").mockRejectedValue(
      new Error("connection refused"),
    );
    const response = await request(app).get("/readyz").expect(503);
    expect(response.body).toMatchObject({
      success: false,
      error: { code: "SERVICE_UNAVAILABLE", requestId: expect.any(String) },
    });
    expect(response.body.error.message).not.toContain("connection refused");
  });

  it("requires a token, rejects garbage tokens and distinguishes expired tokens", async () => {
    await request(app)
      .get("/api/me")
      .expect(401)
      .expect(({ body }) => expect(body.error.code).toBe("MISSING_TOKEN"));

    vi.spyOn(auth, "verifyIdToken").mockRejectedValueOnce(
      Object.assign(new Error("bad token"), {
        code: "auth/invalid-id-token",
      }),
    );
    await request(app)
      .get("/api/me")
      .set("Authorization", "Bearer garbage")
      .expect(401)
      .expect(({ body }) => expect(body.error.code).toBe("INVALID_TOKEN"));

    vi.spyOn(auth, "verifyIdToken").mockRejectedValueOnce(
      Object.assign(new Error("expired"), {
        code: "auth/id-token-expired",
      }),
    );
    await request(app)
      .get("/api/me")
      .set("Authorization", "Bearer expired-token")
      .expect(401)
      .expect(({ body }) => expect(body.error.code).toBe("TOKEN_EXPIRED"));
  });

  it("returns the verified user DTO and ignores untrusted role fields", async () => {
    vi.spyOn(auth, "verifyIdToken").mockResolvedValue({
      uid: "user-1",
      email: "user@example.test",
      email_verified: true,
      role: "freelancer",
    });
    await request(app)
      .get("/api/me")
      .set("Authorization", "Bearer valid-token")
      .expect(200, {
        success: true,
        data: {
          uid: "user-1",
          email: "user@example.test",
          role: "freelancer",
          emailVerified: true,
        },
        meta: {},
      });
  });

  it("rejects unknown routes with a request ID and no stack", async () => {
    const response = await request(app).get("/not-a-route").expect(404);
    expect(response.headers["x-request-id"]).toBe(
      response.body.error.requestId,
    );
    expect(response.body).toMatchObject({
      success: false,
      error: { code: "NOT_FOUND", requestId: expect.any(String) },
    });
    expect(response.body.error.stack).toBeUndefined();
  });

  it("does not echo query parameters in not-found responses", async () => {
    const response = await request(app)
      .get("/not-a-route?token=should-not-leak")
      .expect(404);
    expect(JSON.stringify(response.body)).not.toContain("should-not-leak");
  });

  it("applies the configured CORS allow-list", async () => {
    await request(app)
      .get("/healthz")
      .set("Origin", "http://localhost:5173")
      .expect(200)
      .expect("Access-Control-Allow-Origin", "http://localhost:5173");

    const response = await request(app)
      .get("/healthz")
      .set("Origin", "https://untrusted.example")
      .expect(403);
    expect(response.body.error.code).toBe("CORS_ORIGIN_FORBIDDEN");
  });

  it("rejects non-JSON request bodies on API routes", async () => {
    const response = await request(app)
      .post("/api/no-route")
      .set("Content-Type", "text/plain")
      .send("not json")
      .expect(415);
    expect(response.body.error.code).toBe("UNSUPPORTED_MEDIA_TYPE");
  });
});

describe("middleware and utilities", () => {
  it("returns a standard 429 response after the configured limit", async () => {
    const testApp = express();
    testApp.use(requestId);
    testApp.use(createRateLimiter({ windowMs: 60000, limit: 1 }));
    testApp.get("/limited", (req, res) =>
      res.status(200).json({ success: true }),
    );

    await request(testApp).get("/limited").expect(200);
    const response = await request(testApp).get("/limited").expect(429);
    expect(response.body).toMatchObject({
      success: false,
      error: { code: "RATE_LIMIT_EXCEEDED", requestId: expect.any(String) },
    });
  });

  it("rejects roles not present in the verified token", async () => {
    const testApp = express();
    testApp.use(requestId);
    testApp.use((req, res, next) => {
      req.user = { uid: "user-1", role: "client" };
      next();
    });
    testApp.get("/admin", requireRole("admin"), (req, res) =>
      res.sendStatus(200),
    );
    testApp.use(errorHandler);

    const response = await request(testApp).get("/admin").expect(403);
    expect(response.body.error.code).toBe("FORBIDDEN");
  });

  it("rejects unknown request fields with strict zod validation", async () => {
    const testApp = express();
    testApp.use(express.json());
    testApp.use(requestId);
    testApp.post(
      "/strict",
      validate({
        body: z.object({ title: z.string() }).strict(),
      }),
      (req, res) => res.json({ success: true }),
    );
    testApp.use(errorHandler);

    const response = await request(testApp)
      .post("/strict")
      .send({ title: "ok", ownerId: "spoofed" })
      .expect(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("does not expose stack traces from thrown async controller errors", async () => {
    const testApp = express();
    testApp.use(requestId);
    testApp.get(
      "/throw",
      asyncHandler(async () => {
        throw new Error("internal detail");
      }),
    );
    testApp.use(notFound);
    testApp.use(errorHandler);

    const response = await request(testApp).get("/throw").expect(500);
    expect(response.body).toMatchObject({
      success: false,
      error: { code: "INTERNAL_SERVER_ERROR", requestId: expect.any(String) },
    });
    expect(JSON.stringify(response.body)).not.toContain("internal detail");
    expect(JSON.stringify(response.body)).not.toContain("stack");
  });

  it("supports cursor encoding and enforces bounded page sizes", () => {
    expect(decodeCursor(encodeCursor(["last-id"]))).toEqual(["last-id"]);
    expect(parseLimit(undefined)).toBe(20);
    expect(parseLimit("50")).toBe(50);
    expect(() => parseLimit("51")).toThrow();
    expect(() => parseLimit(["20"])).toThrow();
    expect(() => decodeCursor("not-a-cursor")).toThrow();
  });

  it("uses the standard paginated response envelope", () => {
    const response = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    paginated(response, [{ id: "1" }], "next");
    expect(response.json).toHaveBeenCalledWith({
      success: true,
      data: [{ id: "1" }],
      meta: { nextCursor: "next" },
    });
  });

  it("constructs authorization errors with stable status and code", () => {
    expect(new ForbiddenError().code).toBe("FORBIDDEN");
  });
});

describe("startup configuration", () => {
  it("exits with a clear message when a required variable is missing", async () => {
    const { spawnSync } = await import("node:child_process");
    const childEnv = { ...process.env };
    delete childEnv.FIREBASE_PROJECT_ID;
    childEnv.NODE_ENV = "test";
    childEnv.CORS_ALLOWED_ORIGINS = "http://localhost:5173";

    const result = spawnSync(process.execPath, ["src/server.js"], {
      cwd: new URL("..", import.meta.url),
      env: childEnv,
      encoding: "utf8",
      timeout: 10000,
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Invalid environment configuration");
    expect(result.stderr).toContain("FIREBASE_PROJECT_ID");
  });
});
