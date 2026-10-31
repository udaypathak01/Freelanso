import { Router } from "express";
import { authenticate } from "../../middleware/auth.js";
import { rateLimiters } from "../../middleware/rateLimit.js";
import { requireRole } from "../../middleware/requireRole.js";
import { validate } from "../../middleware/validate.js";
import {
  withdrawalCreateSchema,
  withdrawalEmptySchema,
  withdrawalListQuerySchema,
  withdrawalParamsSchema,
  withdrawalStatusSchema,
} from "./withdrawals.schema.js";
import {
  getMyWithdrawals,
  getWalletHandler,
  patchWithdrawalStatus,
  postWithdrawal,
} from "./withdrawals.controller.js";

const router = Router();

router.get(
  "/wallet",
  authenticate,
  validate({
    body: withdrawalEmptySchema,
    query: withdrawalEmptySchema,
    params: withdrawalEmptySchema,
  }),
  getWalletHandler,
);
router.get(
  "/withdrawals/me",
  authenticate,
  validate({
    body: withdrawalEmptySchema,
    query: withdrawalListQuerySchema,
    params: withdrawalEmptySchema,
  }),
  getMyWithdrawals,
);
router.post(
  "/withdrawals",
  authenticate,
  rateLimiters.write,
  validate({
    body: withdrawalCreateSchema,
    query: withdrawalEmptySchema,
    params: withdrawalEmptySchema,
  }),
  postWithdrawal,
);
router.patch(
  "/withdrawals/:id/status",
  authenticate,
  requireRole("admin"),
  rateLimiters.write,
  validate({
    body: withdrawalStatusSchema,
    query: withdrawalEmptySchema,
    params: withdrawalParamsSchema,
  }),
  patchWithdrawalStatus,
);

export default router;
