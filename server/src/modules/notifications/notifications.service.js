import { logger } from "../../config/logger.js";
import {
  createNotification,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "./notifications.repository.js";

export async function notifyUser(uid, notification, sourceId, requestId) {
  if (!uid || !sourceId || !notification.href?.startsWith("/")) return;
  try {
    await createNotification(uid, notification, sourceId);
  } catch (error) {
    logger.warn(
      {
        requestId,
        recipientUid: uid,
        notificationType: notification.type,
        errorName: error?.name ?? "Error",
      },
      "Could not persist user notification",
    );
  }
}

export async function getNotifications(uid) {
  return listNotifications(uid);
}

export async function readNotification(uid, id) {
  return markNotificationRead(uid, id);
}

export async function readAllNotifications(uid) {
  return markAllNotificationsRead(uid);
}
