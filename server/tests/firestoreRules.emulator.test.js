import { readFile } from "node:fs/promises";
import {
  assertFails,
  initializeTestEnvironment,
} from "@firebase/rules-unit-testing";
import "firebase/compat/app";
import "firebase/compat/firestore";
import { afterAll, beforeAll, describe, it } from "vitest";

const emulatorReady = Boolean(process.env.FIRESTORE_EMULATOR_HOST);
const ownedDocumentPaths = [
  "projects/project-1",
  "services/service-1",
  "jobs/job-1",
  "applications/job-1_user-1",
  "battles/battle-1",
  "wallets/user-1",
  "withdrawals/withdrawal-1",
  "supportTickets/ticket-1",
  "matches/match-1",
];

describe("Firestore client security rules", () => {
  let testEnvironment;

  beforeAll(async () => {
    if (!emulatorReady) return;
    testEnvironment = await initializeTestEnvironment({
      projectId: process.env.FIREBASE_PROJECT_ID || "demo-freelanso-test",
      firestore: {
        rules: await readFile(
          new URL("../firestore.rules", import.meta.url),
          "utf8",
        ),
      },
    });
  });

  afterAll(async () => {
    await testEnvironment?.cleanup();
  });

  it.runIf(emulatorReady)(
    "denies anonymous and authenticated clients every server-owned write",
    async () => {
      const clients = [
        testEnvironment.unauthenticatedContext().firestore(),
        testEnvironment.authenticatedContext("user-1").firestore(),
      ];

      for (const client of clients) {
        for (const path of ownedDocumentPaths) {
          const reference = client.doc(path);
          await assertFails(reference.set({ clientWrite: true }));
          await assertFails(reference.update({ clientWrite: true }));
          await assertFails(reference.delete());
        }
      }
    },
  );

  it.runIf(emulatorReady)(
    "denies reads and writes to unmatched collections by default",
    async () => {
      const client = testEnvironment.authenticatedContext("user-1").firestore();
      const reference = client.doc("unlistedCollection/document-1");

      await assertFails(reference.get());
      await assertFails(reference.set({ value: "not allowed" }));
    },
  );
});
