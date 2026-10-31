import { randomUUID } from "node:crypto";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { app } from "../src/app.js";
import { auth, firestore } from "../src/config/firebase.js";

const authEmulator = process.env.FIREBASE_AUTH_EMULATOR_HOST;
const emulatorReady = Boolean(authEmulator);

async function createAccount() {
  const email = `withdrawal-${randomUUID()}@freelanso.test`;
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

async function setWallet(uid, available, pending = 0) {
  await firestore.collection("wallets").doc(uid).set({
    available,
    pending,
    currency: "INR",
  });
  await firestore.collection("transactions").doc(`opening-${uid}`).set({
    uid,
    entryType: "opening_balance",
    availableDelta: available,
    pendingDelta: pending,
    amount: available + pending,
    currency: "INR",
    createdAt: new Date(),
  });
}

describe("internal withdrawal ledger with Firebase emulators", () => {
  it.runIf(emulatorReady)(
    "returns an empty wallet and rejects unauthenticated, missing-key and invalid amount requests",
    async () => {
      const user = await createAccount();
      await request(app).get("/api/wallet").expect(401);
      const wallet = await request(app)
        .get("/api/wallet")
        .auth(user.token, { type: "bearer" })
        .expect(200);
      expect(wallet.body.data).toMatchObject({
        uid: user.uid,
        available: 0,
        pending: 0,
        currency: "INR",
      });
      await request(app)
        .post("/api/withdrawals")
        .send({ amount: 10000 })
        .expect(401);
      await request(app)
        .post("/api/withdrawals")
        .auth(user.token, { type: "bearer" })
        .send({ amount: 10000 })
        .expect(400);
      await request(app)
        .post("/api/withdrawals")
        .auth(user.token, { type: "bearer" })
        .set("Idempotency-Key", randomUUID())
        .send({ amount: 0 })
        .expect(400);
      await request(app)
        .post("/api/withdrawals")
        .auth(user.token, { type: "bearer" })
        .set("Idempotency-Key", randomUUID())
        .send({ amount: -10000 })
        .expect(400);
      await request(app)
        .post("/api/withdrawals")
        .auth(user.token, { type: "bearer" })
        .set("Idempotency-Key", randomUUID())
        .send({ amount: 10_000.5 })
        .expect(400);
      await request(app)
        .post("/api/withdrawals")
        .auth(user.token, { type: "bearer" })
        .set("Idempotency-Key", randomUUID())
        .send({ amount: 1_000_001 })
        .expect(400);
    },
  );

  it.runIf(emulatorReady)(
    "rejects over-balance requests and reserves funds once for duplicate keys",
    async () => {
      const user = await createAccount();
      await setWallet(user.uid, 25000);
      const overBalance = await request(app)
        .post("/api/withdrawals")
        .auth(user.token, { type: "bearer" })
        .set("Idempotency-Key", randomUUID())
        .send({ amount: 30000 })
        .expect(409);
      expect(overBalance.body.error.code).toBe("CONFLICT");

      const key = randomUUID();
      const first = await request(app)
        .post("/api/withdrawals")
        .auth(user.token, { type: "bearer" })
        .set("Idempotency-Key", key)
        .send({ amount: 20000 })
        .expect(201);
      const duplicate = await request(app)
        .post("/api/withdrawals")
        .auth(user.token, { type: "bearer" })
        .set("Idempotency-Key", key)
        .send({ amount: 20000 })
        .expect(201);
      expect(duplicate.body.data.id).toBe(first.body.data.id);
      await request(app)
        .post("/api/withdrawals")
        .auth(user.token, { type: "bearer" })
        .set("Idempotency-Key", key)
        .send({ amount: 10000 })
        .expect(409);

      const wallet = await firestore.collection("wallets").doc(user.uid).get();
      expect(wallet.data()).toMatchObject({ available: 5000, pending: 20000 });
      const records = await firestore
        .collection("withdrawals")
        .where("uid", "==", user.uid)
        .get();
      expect(records.size).toBe(1);
      const ledger = await firestore
        .collection("transactions")
        .where("uid", "==", user.uid)
        .get();
      expect(ledger.size).toBe(2);
      await request(app)
        .get("/api/withdrawals/me")
        .auth(user.token, { type: "bearer" })
        .expect(200);
    },
  );

  it.runIf(emulatorReady)(
    "uses one transaction to prevent concurrent requests from overdrawing",
    async () => {
      const user = await createAccount();
      await setWallet(user.uid, 1_500_000);
      const responses = await Promise.all([
        request(app)
          .post("/api/withdrawals")
          .auth(user.token, { type: "bearer" })
          .set("Idempotency-Key", randomUUID())
          .send({ amount: 1_000_000 }),
        request(app)
          .post("/api/withdrawals")
          .auth(user.token, { type: "bearer" })
          .set("Idempotency-Key", randomUUID())
          .send({ amount: 1_000_000 }),
      ]);
      expect(responses.map(({ status }) => status).sort()).toEqual([201, 409]);
      const wallet = await firestore.collection("wallets").doc(user.uid).get();
      expect(wallet.data()).toMatchObject({
        available: 500_000,
        pending: 1_000_000,
      });
    },
  );

  it.runIf(emulatorReady)(
    "restores rejected funds atomically and persists admin decisions in the ledger",
    async () => {
      const user = await createAccount();
      const admin = await createAccount();
      await auth.setCustomUserClaims(admin.uid, { role: "admin" });
      const adminToken = await signIn(admin.email);
      await setWallet(user.uid, 120_000);
      const requested = await request(app)
        .post("/api/withdrawals")
        .auth(user.token, { type: "bearer" })
        .set("Idempotency-Key", randomUUID())
        .send({ amount: 20_000 })
        .expect(201);
      await request(app)
        .patch(`/api/withdrawals/${requested.body.data.id}/status`)
        .auth(user.token, { type: "bearer" })
        .send({ status: "rejected" })
        .expect(403);
      const rejected = await request(app)
        .patch(`/api/withdrawals/${requested.body.data.id}/status`)
        .auth(adminToken, { type: "bearer" })
        .send({ status: "rejected" })
        .expect(200);
      expect(rejected.body.data.status).toBe("rejected");

      const wallet = await firestore.collection("wallets").doc(user.uid).get();
      expect(wallet.data()).toMatchObject({ available: 120_000, pending: 0 });
      const ledger = await firestore
        .collection("transactions")
        .where("uid", "==", user.uid)
        .get();
      const deltas = ledger.docs.reduce(
        (total, document) => ({
          available:
            total.available + document.get("availableDelta"),
          pending: total.pending + document.get("pendingDelta"),
        }),
        { available: 0, pending: 0 },
      );
      expect(deltas).toEqual({ available: 120_000, pending: 0 });
      await request(app)
        .patch(`/api/withdrawals/${requested.body.data.id}/status`)
        .auth(adminToken, { type: "bearer" })
        .send({ status: "approved" })
        .expect(409);

      const secondRequest = await request(app)
        .post("/api/withdrawals")
        .auth(user.token, { type: "bearer" })
        .set("Idempotency-Key", randomUUID())
        .send({ amount: 10_000 })
        .expect(201);
      const approved = await request(app)
        .patch(`/api/withdrawals/${secondRequest.body.data.id}/status`)
        .auth(adminToken, { type: "bearer" })
        .send({ status: "approved" })
        .expect(200);
      expect(approved.body.data.status).toBe("approved");
      const afterApproval = await firestore
        .collection("wallets")
        .doc(user.uid)
        .get();
      expect(afterApproval.data()).toMatchObject({
        available: 110_000,
        pending: 10_000,
      });
      const finalLedger = await firestore
        .collection("transactions")
        .where("uid", "==", user.uid)
        .get();
      const finalDeltas = finalLedger.docs.reduce(
        (total, document) => ({
          available:
            total.available + document.get("availableDelta"),
          pending: total.pending + document.get("pendingDelta"),
        }),
        { available: 0, pending: 0 },
      );
      expect(finalDeltas).toEqual({ available: 110_000, pending: 10_000 });
    },
  );
});
