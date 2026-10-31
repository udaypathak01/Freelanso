import { Router } from "express";
import { authenticate } from "../../middleware/auth.js";
import { rateLimiters } from "../../middleware/rateLimit.js";
import { validate } from "../../middleware/validate.js";
import {
  conversationsEmptySchema,
  createConversationSchema,
  messageListQuerySchema,
  messageParamsSchema,
  sendMessageSchema,
} from "./conversations.schema.js";
import {
  getConversations,
  getMessages,
  getUnreadCount,
  postConversation,
  postMessage,
  postReadReceipt,
} from "./conversations.controller.js";

const router = Router();

router.get(
  "/unread-count",
  authenticate,
  validate({
    body: conversationsEmptySchema,
    query: conversationsEmptySchema,
    params: conversationsEmptySchema,
  }),
  getUnreadCount,
);
router.get(
  "/",
  authenticate,
  validate({
    body: conversationsEmptySchema,
    query: conversationsEmptySchema,
    params: conversationsEmptySchema,
  }),
  getConversations,
);
router.post(
  "/",
  authenticate,
  rateLimiters.write,
  validate({
    body: createConversationSchema,
    query: conversationsEmptySchema,
    params: conversationsEmptySchema,
  }),
  postConversation,
);
router.get(
  "/:id/messages",
  authenticate,
  validate({
    body: conversationsEmptySchema,
    query: messageListQuerySchema,
    params: messageParamsSchema,
  }),
  getMessages,
);
router.post(
  "/:id/messages",
  authenticate,
  rateLimiters.message,
  validate({
    body: sendMessageSchema,
    query: conversationsEmptySchema,
    params: messageParamsSchema,
  }),
  postMessage,
);
router.post(
  "/:id/read",
  authenticate,
  validate({
    body: conversationsEmptySchema,
    query: conversationsEmptySchema,
    params: messageParamsSchema,
  }),
  postReadReceipt,
);

export default router;
