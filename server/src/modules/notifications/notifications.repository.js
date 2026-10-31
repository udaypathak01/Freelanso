import { createHash } from "node:crypto";
import { NotFoundError } from "../../utils/AppError.js";
import { realtimeDatabase } from "../../config/firebase.js";

const userNotifications = (uid) =>
  realtimeDatabase.ref(`notifications/${uid}`);

export async function createNotification(uid, notification, sourceId) {
  const id = createHash("sha256")
    .update(`${notification.type}:${sourceId}`)
    .digest("hex");
  const ref = userNotifications(uid).child(id);
  const result = await ref.transaction((current) => current ?? notification);
  return { id, ...result.snapshot.val() };
}

export async function listNotifications(uid) {
  const snapshot = await userNotifications(uid).get();
  return Object.entries(snapshot.val() ?? {})
    .map(([id, notification]) => ({ id, ...notification }))
    .sort((left, right) => (right.createdAt ?? 0) - (left.createdAt ?? 0))
    .slice(0, 100);
}

export async function markNotificationRead(uid, id) {
  const ref = userNotifications(uid).child(id);
  const snapshot = await ref.get();
  if (!snapshot.exists()) throw new NotFoundError("Notification not found");
  if (snapshot.child("readAt").val() == null) {
    await ref.child("readAt").set(Date.now());
  }
  return { id, readAt: (await ref.child("readAt").get()).val() };
}

export async function markAllNotificationsRead(uid) {
  const snapshot = await userNotifications(uid).get();
  const readAt = Date.now();
  const updates = {};
  for (const [id, notification] of Object.entries(snapshot.val() ?? {})) {
    if (notification.readAt == null) updates[`${id}/readAt`] = readAt;
  }
  if (Object.keys(updates).length) await userNotifications(uid).update(updates);
  return { readAt, count: Object.keys(updates).length };
}
