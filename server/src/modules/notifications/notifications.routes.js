import { Router } from "express";
import { authenticate } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import {
  notificationIdParamsSchema,
  notificationsEmptySchema,
} from "./notifications.schema.js";
import {
  getNotificationsHandler,
  markAllNotificationsReadHandler,
  markNotificationReadHandler,
} from "./notifications.controller.js";

const router = Router();

router.get(
  "/",
  authenticate,
  validate({
    body: notificationsEmptySchema,
    query: notificationsEmptySchema,
    params: notificationsEmptySchema,
  }),
  getNotificationsHandler,
);
router.post(
  "/read-all",
  authenticate,
  validate({
    body: notificationsEmptySchema,
    query: notificationsEmptySchema,
    params: notificationsEmptySchema,
  }),
  markAllNotificationsReadHandler,
);
router.post(
  "/:id/read",
  authenticate,
  validate({
    body: notificationsEmptySchema,
    query: notificationsEmptySchema,
    params: notificationIdParamsSchema,
  }),
  markNotificationReadHandler,
);

export default router;
