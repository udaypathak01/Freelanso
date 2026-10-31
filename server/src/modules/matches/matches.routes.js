import { Router } from "express";
import { authenticate } from "../../middleware/auth.js";
import { rateLimiters } from "../../middleware/rateLimit.js";
import { validate } from "../../middleware/validate.js";
import { emptyObjectSchema, matchScoreAllSchema } from "./matches.schema.js";
import { postScoreAllMatches } from "./matches.controller.js";

const router = Router();

router.post(
  "/score-all",
  authenticate,
  rateLimiters.ai,
  validate({
    body: matchScoreAllSchema,
    query: emptyObjectSchema,
    params: emptyObjectSchema,
  }),
  postScoreAllMatches,
);

export default router;
