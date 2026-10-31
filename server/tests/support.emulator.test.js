import { randomUUID } from "node:crypto";
import express from "express";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { app } from "../src/app.js";
import { auth, firestore } from "../src/config/firebase.js";
import { createRateLimiter } from "../src/middleware/rateLimit.js";

const authEmulator = process.env.FIREBASE_AUTH_EMULATOR_HOST;
const emulatorReady = Boolean(authEmulator);

async function createAccount() {
  const email = `support-${randomUUID()}@freelanso.test`;
  const response = await fetch(
    `http://${authEmulator}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-api-key`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        password: "A-valid-test-password-123",
        returnSecureToken: true,
      }),
    },
  );
  expect(response.ok).toBe(true);
  const account = await response.json();
  return { uid: account.localId, email, token: account.idToken };
}

async function signIn(email) {
  const response = await fetch(
    `http://${authEmulator}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake-api-key`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        password: "A-valid-test-password-123",
        returnSecureToken: true,
      }),
    },
  );
  expect(response.ok).toBe(true);
  return (await response.json()).idToken;
}

function validTicket(overrides = {}) {
  return {
    name: "Freelanso User",
    email: "person@example.test",
    subject: "Technical Support",
    message: "I need help with a support request.",
    ...overrides,
  };
}

describe("support UID rate limiting", () => {
  it("limits an authenticated UID to five requests in the configured hour window", async () => {
    const limiter = createRateLimiter({
      windowMs: 60 * 60 * 1000,
      limit: 5,
      keyGenerator: (req) => req.user.uid,
    });
    const testApp = express();
    const uid = `support-rate-${randomUUID()}`;
    testApp.use((req, _res, next) => {
      req.user = { uid };
      return next();
    });
    testApp.use(limiter);
    testApp.get("/", (_req, res) => res.sendStatus(200));

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await request(testApp).get("/").expect(200);
    }
    await request(testApp).get("/").expect(429);
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("support tickets with Firebase emulators", () => {
  it.runIf(emulatorReady)(
    "stores a signed-in ticket once for duplicate Idempotency-Key requests and lists it privately",
    async () => {
      const user = await createAccount();
      const key = randomUUID();
      const first = await request(app)
        .post("/api/support/tickets")
        .auth(user.token, { type: "bearer" })
        .set("Idempotency-Key", key)
        .send(validTicket({ email: user.email }))
        .expect(201);
      const duplicate = await request(app)
        .post("/api/support/tickets")
        .auth(user.token, { type: "bearer" })
        .set("Idempotency-Key", key)
        .send(validTicket({ email: user.email }))
        .expect(201);

      expect(duplicate.body.data.id).toBe(first.body.data.id);
      expect(first.body.data).not.toHaveProperty("email");
      expect(first.body.data).not.toHaveProperty("message");
      const stored = await firestore
        .collection("supportTickets")
        .where("userId", "==", user.uid)
        .get();
      expect(stored.size).toBe(1);
      expect(stored.docs[0].get("userId")).toBe(user.uid);

      const listed = await request(app)
        .get("/api/support/tickets/me")
        .auth(user.token, { type: "bearer" })
        .expect(200);
      expect(listed.body.data.map(({ id }) => id)).toEqual([first.body.data.id]);
      await request(app).get("/api/support/tickets/me").expect(401);
    },
  );

  it.runIf(emulatorReady)(
    "rejects a populated honeypot and strict-schema extra fields",
    async () => {
      const before = await firestore.collection("supportTickets").count().get();
      const honeypot = await request(app)
        .post("/api/support/tickets")
        .send(validTicket({ companyWebsite: "https://spam.example" }))
        .expect(400);
      expect(honeypot.body.error.message).toMatch(/could not be accepted/i);

      const extraField = await request(app)
        .post("/api/support/tickets")
        .send(validTicket({ userId: "forged" }))
        .expect(400);
      expect(extraField.body.error.code).toBe("VALIDATION_ERROR");
      const after = await firestore.collection("supportTickets").count().get();
      expect(after.data().count).toBe(before.data().count);
    },
  );

  it.runIf(emulatorReady)(
    "allows only admins to list and transition tickets",
    async () => {
      const user = await createAccount();
      const admin = await createAccount();
      await auth.setCustomUserClaims(admin.uid, { role: "admin" });
      const adminToken = await signIn(admin.email);
      const ticketId = `support-test-${randomUUID()}`;
      await firestore.collection("supportTickets").doc(ticketId).set({
        userId: user.uid,
        name: "Test User",
        email: user.email,
        subject: "Test ticket",
        message: "Test content in a support ticket.",
        status: "open",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await request(app).get("/api/support/tickets").expect(401);
      await request(app)
        .get("/api/support/tickets")
        .auth(user.token, { type: "bearer" })
        .expect(403);
      const listed = await request(app)
        .get("/api/support/tickets")
        .auth(adminToken, { type: "bearer" })
        .expect(200);
      expect(listed.body.data.some(({ id }) => id === ticketId)).toBe(true);

      const updated = await request(app)
        .patch(`/api/support/tickets/${ticketId}/status`)
        .auth(adminToken, { type: "bearer" })
        .send({ status: "in_progress" })
        .expect(200);
      expect(updated.body.data.status).toBe("in_progress");
      await request(app)
        .patch(`/api/support/tickets/${ticketId}/status`)
        .auth(adminToken, { type: "bearer" })
        .send({ status: "open" })
        .expect(200);
    },
  );

  it.runIf(emulatorReady)(
    "enforces the strict per-IP hourly ticket limit",
    async () => {
      await request(app).post("/api/support/tickets").send(validTicket()).expect(201);
      await request(app).post("/api/support/tickets").send(validTicket()).expect(429);
    },
  );
});
