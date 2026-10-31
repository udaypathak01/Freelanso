import { Router } from "express";
import { authenticate } from "../../middleware/auth.js";
import { rateLimiters } from "../../middleware/rateLimit.js";
import { validate } from "../../middleware/validate.js";
import {
  emptyObjectSchema,
  onboardingSchema,
  profileUpdateSchema,
  uidParamsSchema,
} from "./users.schema.js";
import {
  getMe,
  getPublic,
  onboardRole,
  putProfile,
} from "./users.controller.js";

const router = Router();

router.post(
  "/onboarding",
  authenticate,
  rateLimiters.write,
  validate({
    body: onboardingSchema,
    query: emptyObjectSchema,
    params: emptyObjectSchema,
  }),
  onboardRole,
);
router.get(
  "/me",
  authenticate,
  validate({
    body: emptyObjectSchema,
    query: emptyObjectSchema,
    params: emptyObjectSchema,
  }),
  getMe,
);
router.get(
  "/:uid",
  validate({
    body: emptyObjectSchema,
    query: emptyObjectSchema,
    params: uidParamsSchema,
  }),
  getPublic,
);
router.put(
  "/:uid",
  authenticate,
  rateLimiters.write,
  validate({
    body: profileUpdateSchema,
    query: emptyObjectSchema,
    params: uidParamsSchema,
  }),
  putProfile,
);

export default router;
