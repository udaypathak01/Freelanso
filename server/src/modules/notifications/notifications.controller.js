import { asyncHandler } from "../../utils/asyncHandler.js";
import { ok } from "../../utils/response.js";
import {
  getNotifications,
  readAllNotifications,
  readNotification,
} from "./notifications.service.js";

export const getNotificationsHandler = asyncHandler(async (req, res) =>
  ok(res, await getNotifications(req.user.uid)),
);

export const markNotificationReadHandler = asyncHandler(async (req, res) =>
  ok(res, await readNotification(req.user.uid, req.validated.params.id)),
);

export const markAllNotificationsReadHandler = asyncHandler(
  async (req, res) => ok(res, await readAllNotifications(req.user.uid)),
);
