import { Router } from "express";
import { authenticate, authenticateOptional } from "../../middleware/auth.js";
import { rateLimiters } from "../../middleware/rateLimit.js";
import { requireRole } from "../../middleware/requireRole.js";
import { validate } from "../../middleware/validate.js";
import {
  supportEmptySchema,
  supportTicketCreateSchema,
  supportTicketPageSchema,
  supportTicketParamsSchema,
  supportTicketStatusSchema,
} from "./support.schema.js";
import {
  getMySupportTicketsHandler,
  getSupportTicketsHandler,
  patchSupportTicketStatus,
  postSupportTicket,
} from "./support.controller.js";

const router = Router();

router.post(
  "/",
  authenticateOptional,
  rateLimiters.supportIp,
  rateLimiters.supportUser,
  validate({
    body: supportTicketCreateSchema,
    query: supportEmptySchema,
    params: supportEmptySchema,
  }),
  postSupportTicket,
);
router.get(
  "/me",
  authenticate,
  validate({
    body: supportEmptySchema,
    query: supportTicketPageSchema,
    params: supportEmptySchema,
  }),
  getMySupportTicketsHandler,
);
router.get(
  "/",
  authenticate,
  requireRole("admin"),
  validate({
    body: supportEmptySchema,
    query: supportTicketPageSchema,
    params: supportEmptySchema,
  }),
  getSupportTicketsHandler,
);
router.patch(
  "/:id/status",
  authenticate,
  requireRole("admin"),
  validate({
    body: supportTicketStatusSchema,
    query: supportEmptySchema,
    params: supportTicketParamsSchema,
  }),
  patchSupportTicketStatus,
);

export default router;
