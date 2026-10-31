import { applicationDefault, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getDatabase } from "firebase-admin/database";
import { env } from "./env.js";

const useEmulators = Boolean(
  env.firestoreEmulatorHost && env.firebaseAuthEmulatorHost,
);
const existingApp = getApps().find((app) => app.name === "[DEFAULT]");
const app =
  existingApp ||
  initializeApp({
    projectId: env.firebaseProjectId,
    databaseURL: env.firebaseDatabaseUrl,
    ...(useEmulators ? {} : { credential: applicationDefault() }),
  });

export const auth = getAuth(app);
export const firestore = getFirestore(app);
export const realtimeDatabase = getDatabase(app);
