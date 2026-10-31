import { Router } from "express";
import { authenticate } from "../../middleware/auth.js";
import { rateLimiters } from "../../middleware/rateLimit.js";
import { validate } from "../../middleware/validate.js";
import {
  applicationEmptySchema,
  applicationIdParamsSchema,
  applicationListQuerySchema,
  applicationStatusSchema,
} from "./applications.schema.js";
import {
  getMyApplications,
  patchApplicationStatus,
} from "./applications.controller.js";

const router = Router();

router.get(
  "/me",
  authenticate,
  validate({
    body: applicationEmptySchema,
    query: applicationListQuerySchema,
    params: applicationEmptySchema,
  }),
  getMyApplications,
);
router.patch(
  "/:id/status",
  authenticate,
  rateLimiters.write,
  validate({
    body: applicationStatusSchema,
    query: applicationEmptySchema,
    params: applicationIdParamsSchema,
  }),
  patchApplicationStatus,
);

export default router;
