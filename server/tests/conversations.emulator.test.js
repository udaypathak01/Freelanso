import { randomUUID } from "node:crypto";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { app } from "../src/app.js";
import { firestore, realtimeDatabase } from "../src/config/firebase.js";
import { migrateConversationShapes } from "../src/modules/conversations/conversations.repository.js";

const authEmulator = process.env.FIREBASE_AUTH_EMULATOR_HOST;
const emulatorReady = Boolean(authEmulator && process.env.FIREBASE_DATABASE_EMULATOR_HOST);

async function createAccount() {
  const email = `conversation-${randomUUID()}@freelanso.test`;
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
  return { uid: account.localId, token: account.idToken };
}

async function seedProfile(uid, displayName) {
  await firestore.collection("users").doc(uid).set({
    displayName,
    photoURL: null,
    role: "freelancer",
  });
}

async function readRealtimeAsUser(path, token) {
  const query = new URLSearchParams({
    ns: new URL(process.env.FIREBASE_DATABASE_URL).hostname.split(".")[0],
    auth: token,
  });
  return fetch(
    `http://${process.env.FIREBASE_DATABASE_EMULATOR_HOST}/${path}.json?${query}`,
  );
}

async function writeRealtimeAsUser(path, value, token) {
  const query = new URLSearchParams({
    ns: new URL(process.env.FIREBASE_DATABASE_URL).hostname.split(".")[0],
    auth: token,
  });
  return fetch(
    `http://${process.env.FIREBASE_DATABASE_EMULATOR_HOST}/${path}.json?${query}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(value),
    },
  );
}

describe("Realtime Database conversation membership", () => {
  it.runIf(emulatorReady)(
    "creates one canonical conversation and denies reads to a nonparticipant",
    async () => {
      const [caller, recipient, thirdParty] = await Promise.all([
        createAccount(),
        createAccount(),
        createAccount(),
      ]);
      await Promise.all([
        seedProfile(caller.uid, "Caller"),
        seedProfile(recipient.uid, "Recipient"),
        seedProfile(thirdParty.uid, "Third Party"),
      ]);

      await request(app)
        .post("/api/conversations")
        .send({ recipientUid: recipient.uid })
        .expect(401);
      const created = await request(app)
        .post("/api/conversations")
        .auth(caller.token, { type: "bearer" })
        .send({ recipientUid: recipient.uid, participants: [thirdParty.uid] })
        .expect(400);
      await request(app)
        .post("/api/conversations")
        .auth(caller.token, { type: "bearer" })
        .send({ recipientId: caller.uid })
        .expect(400);
      expect(created.body.error.code).toBe("VALIDATION_ERROR");

      const first = await request(app)
        .post("/api/conversations")
        .auth(caller.token, { type: "bearer" })
        .send({ recipientUid: recipient.uid })
        .expect(201);
      const duplicate = await request(app)
        .post("/api/conversations")
        .auth(caller.token, { type: "bearer" })
        .send({ recipientUid: recipient.uid })
        .expect(201);
      expect(duplicate.body.data.id).toBe(first.body.data.id);
      expect(first.body.data.participants).toEqual(
        [caller.uid, recipient.uid].sort(),
      );
      expect(Array.isArray(first.body.data.participants)).toBe(true);
      expect(first.body.data.unread).toMatchObject({
        [caller.uid]: 0,
        [recipient.uid]: 0,
      });
      const listed = await request(app)
        .get("/api/conversations")
        .auth(caller.token, { type: "bearer" })
        .expect(200);
      expect(listed.body.data.map(({ id }) => id)).toContain(first.body.data.id);

      const stored = await realtimeDatabase
        .ref(`conversations/${first.body.data.id}`)
        .get();
      expect(stored.val().participants).toEqual([caller.uid, recipient.uid].sort());
      expect(stored.val().participantsMap).toEqual({
        [caller.uid]: true,
        [recipient.uid]: true,
      });
      const index = await realtimeDatabase
        .ref(`userConversations/${caller.uid}/${first.body.data.id}`)
        .get();
      expect(index.val()).toBe(true);

      const ownerRead = await readRealtimeAsUser(
        `conversations/${first.body.data.id}`,
        caller.token,
      );
      expect(ownerRead.status).toBe(200);
      expect(await ownerRead.json()).not.toBeNull();
      const forbiddenRead = await readRealtimeAsUser(
        `conversations/${first.body.data.id}`,
        thirdParty.token,
      );
      expect(
        forbiddenRead.status !== 200 || (await forbiddenRead.json()) === null,
      ).toBe(true);

      const forbiddenIndexRead = await readRealtimeAsUser(
        `userConversations/${caller.uid}`,
        thirdParty.token,
      );
      expect(forbiddenIndexRead.status).not.toBe(200);

      const invalidMessageWrite = await writeRealtimeAsUser(
        `messages/${first.body.data.id}/intrusion`,
        {
          senderId: thirdParty.uid,
          text: "not my conversation",
          createdAt: Date.now(),
        },
        thirdParty.token,
      );
      expect(invalidMessageWrite.ok).toBe(false);

      const extraFieldWrite = await writeRealtimeAsUser(
        `messages/${first.body.data.id}/extra-field`,
        {
          senderId: caller.uid,
          text: "unexpected private field",
          createdAt: Date.now(),
          email: "private@example.invalid",
        },
        caller.token,
      );
      expect(extraFieldWrite.ok).toBe(false);

      const participantMessageWrite = await writeRealtimeAsUser(
        `messages/${first.body.data.id}/valid-message`,
        {
          senderId: caller.uid,
          text: "messages must pass through the authenticated API",
          createdAt: Date.now(),
        },
        caller.token,
      );
      expect(participantMessageWrite.ok).toBe(false);

      const sent = await request(app)
        .post(`/api/conversations/${first.body.data.id}/messages`)
        .auth(caller.token, { type: "bearer" })
        .send({ text: "Hello in real time", tempId: "stable-message-id" })
        .expect(201);
      const duplicateMessage = await request(app)
        .post(`/api/conversations/${first.body.data.id}/messages`)
        .auth(caller.token, { type: "bearer" })
        .send({ text: "Hello in real time", tempId: "stable-message-id" })
        .expect(201);
      expect(duplicateMessage.body.data.id).toBe(sent.body.data.id);

      await request(app)
        .get(`/api/conversations/${first.body.data.id}/messages?limit=30`)
        .auth(thirdParty.token, { type: "bearer" })
        .expect(403);
      const history = await request(app)
        .get(`/api/conversations/${first.body.data.id}/messages?limit=30`)
        .auth(recipient.token, { type: "bearer" })
        .expect(200);
      expect(history.body.data).toHaveLength(1);
      expect(history.body.data[0].text).toBe("Hello in real time");

      const unreadBeforeRead = await request(app)
        .get("/api/conversations/unread-count")
        .auth(recipient.token, { type: "bearer" })
        .expect(200);
      expect(unreadBeforeRead.body.data.total).toBe(1);
      await request(app)
        .post(`/api/conversations/${first.body.data.id}/read`)
        .auth(recipient.token, { type: "bearer" })
        .send({})
        .expect(200);
      const unreadAfterRead = await request(app)
        .get("/api/conversations/unread-count")
        .auth(recipient.token, { type: "bearer" })
        .expect(200);
      expect(unreadAfterRead.body.data.total).toBe(0);

      const pageRef = realtimeDatabase.ref(`messages/${first.body.data.id}`);
      const olderMessages = Object.fromEntries(
        Array.from({ length: 31 }, (_, index) => {
          const messageRef = pageRef.push();
          return [
            messageRef.key,
            {
              senderId: caller.uid,
              text: `Pagination test ${index}`,
              createdAt: Date.now() + index,
            },
          ];
        }),
      );
      await pageRef.update(olderMessages);
      const latestPage = await request(app)
        .get(`/api/conversations/${first.body.data.id}/messages?limit=30`)
        .auth(recipient.token, { type: "bearer" })
        .expect(200);
      expect(latestPage.body.data).toHaveLength(30);
      expect(latestPage.body.meta.hasMore).toBe(true);
      const olderPage = await request(app)
        .get(
          `/api/conversations/${first.body.data.id}/messages?limit=30&before=${latestPage.body.meta.nextCursor}`,
        )
        .auth(recipient.token, { type: "bearer" })
        .expect(200);
      expect(olderPage.body.data).toHaveLength(2);
      expect(olderPage.body.meta.hasMore).toBe(false);
    },
  );

  it.runIf(emulatorReady)(
    "migrates legacy object participants into the canonical array and index",
    async () => {
      const [first, second] = await Promise.all([
        createAccount(),
        createAccount(),
      ]);
      const id = `legacy-${randomUUID()}`;
      await realtimeDatabase.ref(`conversations/${id}`).set({
        participants: { [first.uid]: first.uid, [second.uid]: second.uid },
        userInfo: {},
        lastMessage: "legacy",
      });

      const result = await migrateConversationShapes();
      expect(result.migrated).toBeGreaterThanOrEqual(1);
      const migrated = await realtimeDatabase
        .ref(`conversations/${id}`)
        .get();
      expect(migrated.val().participants).toEqual([first.uid, second.uid].sort());
      expect(migrated.val().participantsMap).toEqual({
        [first.uid]: true,
        [second.uid]: true,
      });
      const indexed = await realtimeDatabase
        .ref(`userConversations/${second.uid}/${id}`)
        .get();
      expect(indexed.val()).toBe(true);
    },
  );
});
