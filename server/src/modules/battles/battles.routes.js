import { Router } from "express";
import { authenticate } from "../../middleware/auth.js";
import { authenticateOptional } from "../../middleware/authOptional.js";
import { rateLimiters } from "../../middleware/rateLimit.js";
import { validate } from "../../middleware/validate.js";
import {
  battleCreateSchema,
  battleEmptySchema,
  battleIdParamsSchema,
  battleListQuerySchema,
  battleVoteSchema,
} from "./battles.schema.js";
import {
  getBattleById,
  getBattleVote,
  getBattles,
  postBattle,
  postBattleVote,
} from "./battles.controller.js";

const router = Router();

router.get(
  "/",
  validate({
    body: battleEmptySchema,
    query: battleListQuerySchema,
    params: battleEmptySchema,
  }),
  getBattles,
);
router.post(
  "/",
  authenticate,
  rateLimiters.write,
  validate({
    body: battleCreateSchema,
    query: battleEmptySchema,
    params: battleEmptySchema,
  }),
  postBattle,
);
router.post(
  "/:id/vote",
  authenticate,
  rateLimiters.social,
  validate({
    body: battleVoteSchema,
    query: battleEmptySchema,
    params: battleIdParamsSchema,
  }),
  postBattleVote,
);
router.get(
  "/:id/user-vote",
  authenticate,
  validate({
    body: battleEmptySchema,
    query: battleEmptySchema,
    params: battleIdParamsSchema,
  }),
  getBattleVote,
);
router.get(
  "/:id",
  authenticateOptional,
  validate({
    body: battleEmptySchema,
    query: battleEmptySchema,
    params: battleIdParamsSchema,
  }),
  getBattleById,
);

export default router;
