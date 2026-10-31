import { randomUUID } from "node:crypto";
import request from "supertest";
import { Timestamp } from "firebase-admin/firestore";
import { describe, expect, it } from "vitest";
import { app } from "../src/app.js";
import { firestore } from "../src/config/firebase.js";
import { voteForBattle } from "../src/modules/battles/battles.repository.js";

const emulatorReady = Boolean(process.env.FIREBASE_AUTH_EMULATOR_HOST);
const cloudImage = (id) =>
  `https://res.cloudinary.com/test-cloud/image/upload/v123/users/test/battles/${id}.jpg`;

async function createAccount() {
  const email = `battle-${randomUUID()}@freelanso.test`;
  const response = await fetch(
    `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-api-key`,
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

function battleInput(overrides = {}) {
  return {
    title: "Community design battle",
    category: "UI/UX",
    options: [
      {
        title: "Blue dashboard",
        description: "A clear dashboard with a blue palette.",
        imageUrl: cloudImage("blue"),
        author: "Designer A",
      },
      {
        title: "Purple dashboard",
        description: "A clear dashboard with a purple palette.",
        imageUrl: cloudImage("purple"),
        author: "Designer B",
      },
    ],
    endsAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    ...overrides,
  };
}

async function createBattle(token, input = battleInput()) {
  const response = await request(app)
    .post("/api/battles")
    .auth(token, { type: "bearer" })
    .send(input)
    .expect(201);
  return response.body.data;
}

describe("skill battles with Firebase emulators", () => {
  it.runIf(emulatorReady)(
    "validates access and creation, maps the UI contract, and permits creator votes",
    async () => {
      const creator = await createAccount();
      await request(app).post("/api/battles").send(battleInput()).expect(401);
      const signature = await request(app)
        .post("/api/uploads/sign")
        .auth(creator.token, { type: "bearer" })
        .send({ purpose: "battle", resourceType: "image" })
        .expect(200);
      expect(signature.body.data.assetFolder).toBe(
        `users/${creator.uid}/battles`,
      );
      expect(signature.body.data.allowedFormats).toBe("jpg,png,webp");
      expect(signature.body.data.maxFileSize).toBe(5 * 1024 * 1024);

      const battle = await createBattle(creator.token);
      expect(battle.status).toBe("live");
      expect(battle.entry_A.title).toBe("Blue dashboard");
      expect(battle.entry_B.image_url).toBe(cloudImage("purple"));
      expect(battle.votesTotal).toBe(0);
      const liveList = await request(app)
        .get(
          `/api/battles?${new URLSearchParams({ filter: "live", category: "UI/UX" })}`,
        )
        .expect(200);
      expect(liveList.body.data.some(({ id }) => id === battle.id)).toBe(true);

      const publicDetail = await request(app)
        .get(`/api/battles/${battle.id}`)
        .expect(200);
      expect(publicDetail.body.data.userVote).toBeNull();
      expect(publicDetail.body.data.options).toHaveLength(2);
      const noVote = await request(app)
        .get(`/api/battles/${battle.id}/user-vote`)
        .auth(creator.token, { type: "bearer" })
        .expect(200);
      expect(noVote.body.data).toEqual({ voted: false, side: null });

      const firstVote = await request(app)
        .post(`/api/battles/${battle.id}/vote`)
        .auth(creator.token, { type: "bearer" })
        .send({ optionId: "A" })
        .expect(200);
      expect(firstVote.body.data.userVote).toBe("A");
      expect(firstVote.body.data.votes_A).toBe(1);
      const storedVote = await request(app)
        .get(`/api/battles/${battle.id}/user-vote`)
        .auth(creator.token, { type: "bearer" })
        .expect(200);
      expect(storedVote.body.data).toEqual({ voted: true, side: "A" });
      const votedDetail = await request(app)
        .get(`/api/battles/${battle.id}`)
        .auth(creator.token, { type: "bearer" })
        .expect(200);
      expect(votedDetail.body.data.userVote).toBe("A");

      await request(app)
        .post(`/api/battles/${battle.id}/vote`)
        .auth(creator.token, { type: "bearer" })
        .send({ optionId: "B" })
        .expect(409);
      await request(app)
        .post(`/api/battles/${battle.id}/vote`)
        .send({ optionId: "A" })
        .expect(401);
      const stored = await firestore.collection("battles").doc(battle.id).get();
      expect(stored.get("votesTotal")).toBe(1);
      expect(stored.get("voteCounts")).toEqual({ A: 1, B: 0 });
    },
  );

  it.runIf(emulatorReady)(
    "rejects invalid options, foreign images, tampering, and too many options",
    async () => {
      const creator = await createAccount();
      const valid = battleInput();
      await request(app)
        .post("/api/battles")
        .auth(creator.token, { type: "bearer" })
        .send({ ...valid, status: "closed" })
        .expect(400);
      await request(app)
        .post("/api/battles")
        .auth(creator.token, { type: "bearer" })
        .send(
          battleInput({
            endsAt: new Date(Date.now() - 1000).toISOString(),
          }),
        )
        .expect(400);
      await request(app)
        .post("/api/battles")
        .auth(creator.token, { type: "bearer" })
        .send(
          battleInput({
            endsAt: new Date(
              Date.now() + 91 * 24 * 60 * 60 * 1000,
            ).toISOString(),
          }),
        )
        .expect(400);
      await request(app)
        .post("/api/battles")
        .auth(creator.token, { type: "bearer" })
        .send({
          ...valid,
          options: valid.options.map((option, index) =>
            index === 0
              ? { ...option, imageUrl: "https://example.com/image.jpg" }
              : option,
          ),
        })
        .expect(400);
      await request(app)
        .post("/api/battles")
        .auth(creator.token, { type: "bearer" })
        .send({
          ...valid,
          options: Array.from({ length: 7 }, (_, index) => ({
            ...valid.options[index % 2],
            title: `Entry ${index}`,
            imageUrl: cloudImage(`entry-${index}`),
          })),
        })
        .expect(400);

      const sixOptions = Array.from({ length: 6 }, (_, index) => ({
        ...valid.options[index % 2],
        title: `Entry ${index}`,
        imageUrl: cloudImage(`six-${index}`),
      }));
      const sixOptionBattle = await createBattle(
        creator.token,
        battleInput({ options: sixOptions }),
      );
      expect(sixOptionBattle.options).toHaveLength(6);

      const battle = await createBattle(creator.token);
      await request(app)
        .post(`/api/battles/${battle.id}/vote`)
        .auth(creator.token, { type: "bearer" })
        .send({ optionId: "Z" })
        .expect(400);
      await request(app)
        .post(`/api/battles/${battle.id}/vote`)
        .auth(creator.token, { type: "bearer" })
        .send({ optionId: "A", votesTotal: 500 })
        .expect(400);
      await request(app)
        .post(`/api/battles/missing-battle/vote`)
        .auth(creator.token, { type: "bearer" })
        .send({ optionId: "A" })
        .expect(404);
    },
  );

  it.runIf(emulatorReady)(
    "serializes 100 concurrent distinct votes without count drift",
    async () => {
      const creator = await createAccount();
      const battle = await createBattle(creator.token);
      const results = await Promise.all(
        Array.from({ length: 100 }, (_, index) =>
          voteForBattle(
            battle.id,
            `concurrent-voter-${index}`,
            index % 2 ? "A" : "B",
          ),
        ),
      );
      expect(results.every(({ reason }) => reason === "voted")).toBe(true);

      const stored = await firestore.collection("battles").doc(battle.id).get();
      const voteCount = await firestore
        .collection("battles")
        .doc(battle.id)
        .collection("votes")
        .count()
        .get();
      expect(voteCount.data().count).toBe(100);
      expect(stored.get("votesTotal")).toBe(100);
      expect(stored.get("voteCounts")).toEqual({ A: 50, B: 50 });
    },
    60000,
  );

  it.runIf(emulatorReady)(
    "closes expired battles on access and rejects votes on expired or closed battles",
    async () => {
      const creator = await createAccount();
      const expiredId = `expired-${randomUUID()}`;
      await firestore
        .collection("battles")
        .doc(expiredId)
        .set({
          creatorId: creator.uid,
          title: "Expired test battle",
          description: "",
          category: "UI/UX",
          options: [
            { id: "A", label: "A", description: "", imageUrl: cloudImage("a") },
            { id: "B", label: "B", description: "", imageUrl: cloudImage("b") },
          ],
          votesTotal: 3,
          voteCounts: { A: 2, B: 1 },
          status: "open",
          startsAt: Timestamp.fromMillis(Date.now() - 86400000),
          endsAt: Timestamp.fromMillis(Date.now() - 1000),
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        });

      await request(app)
        .post(`/api/battles/${expiredId}/vote`)
        .auth(creator.token, { type: "bearer" })
        .send({ optionId: "A" })
        .expect(409);
      const expired = await firestore
        .collection("battles")
        .doc(expiredId)
        .get();
      expect(expired.get("status")).toBe("closed");
      expect(expired.get("winnerOptionId")).toBe("A");
      const endedList = await request(app)
        .get("/api/battles?filter=ended")
        .expect(200);
      expect(endedList.body.data.some(({ id }) => id === expiredId)).toBe(true);

      const closedId = `closed-${randomUUID()}`;
      await firestore
        .collection("battles")
        .doc(closedId)
        .set({
          creatorId: creator.uid,
          title: "Closed test battle",
          description: "",
          category: "UI/UX",
          options: [
            { id: "A", label: "A", description: "", imageUrl: cloudImage("a") },
            { id: "B", label: "B", description: "", imageUrl: cloudImage("b") },
          ],
          votesTotal: 0,
          voteCounts: { A: 0, B: 0 },
          status: "closed",
          startsAt: Timestamp.now(),
          endsAt: Timestamp.fromMillis(Date.now() + 3600000),
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        });
      await request(app)
        .post(`/api/battles/${closedId}/vote`)
        .auth(creator.token, { type: "bearer" })
        .send({ optionId: "A" })
        .expect(409);
    },
  );

  it.runIf(emulatorReady)(
    "paginates battle results without duplicates",
    async () => {
      const creator = await createAccount();
      const ids = [];
      for (let index = 0; index < 3; index += 1) {
        const battle = await createBattle(
          creator.token,
          battleInput({ title: `Pagination battle ${index}` }),
        );
        ids.push(battle.id);
      }

      let cursor;
      const seen = [];
      do {
        const params = new URLSearchParams({ filter: "all", limit: "1" });
        if (cursor) params.set("cursor", cursor);
        const page = await request(app)
          .get(`/api/battles?${params.toString()}`)
          .expect(200);
        seen.push(...page.body.data.map(({ id }) => id));
        cursor = page.body.meta.nextCursor;
      } while (cursor && seen.length < 10);

      expect(new Set(seen).size).toBe(seen.length);
      expect(ids.every((id) => seen.includes(id))).toBe(true);
    },
  );
});
