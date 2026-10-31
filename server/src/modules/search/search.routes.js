import { Router } from "express";
import { authenticate } from "../../middleware/auth.js";
import { rateLimiters } from "../../middleware/rateLimit.js";
import { validate } from "../../middleware/validate.js";
import { emptyObjectSchema, smartSearchSchema } from "./smartSearch.schema.js";
import { postSmartSearch } from "./smartSearch.controller.js";

const router = Router();

router.post(
  "/smart",
  authenticate,
  rateLimiters.ai,
  validate({
    body: smartSearchSchema,
    query: emptyObjectSchema,
    params: emptyObjectSchema,
  }),
  postSmartSearch,
);

export default router;
