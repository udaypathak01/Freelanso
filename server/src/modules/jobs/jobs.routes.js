import { Router } from "express";
import { authenticate } from "../../middleware/auth.js";
import { rateLimiters } from "../../middleware/rateLimit.js";
import { validate } from "../../middleware/validate.js";
import {
  emptyObjectSchema,
  jobCreateSchema,
  jobIdParamsSchema,
  jobListQuerySchema,
  jobUpdateSchema,
} from "./jobs.schema.js";
import {
  getJobById,
  getMyJobs,
  getJobs,
  postJob,
  putJob,
  removeJob,
} from "./jobs.controller.js";
import {
  getJobApplications,
  postApplication,
} from "../applications/applications.controller.js";
import {
  applicationCreateSchema,
  applicationListQuerySchema,
} from "../applications/applications.schema.js";

const router = Router();

router.get(
  "/",
  validate({
    body: emptyObjectSchema,
    query: jobListQuerySchema,
    params: emptyObjectSchema,
  }),
  getJobs,
);
router.get(
  "/mine",
  authenticate,
  validate({
    body: emptyObjectSchema,
    query: applicationListQuerySchema,
    params: emptyObjectSchema,
  }),
  getMyJobs,
);
router.post(
  "/",
  authenticate,
  rateLimiters.write,
  validate({
    body: jobCreateSchema,
    query: emptyObjectSchema,
    params: emptyObjectSchema,
  }),
  postJob,
);
router.get(
  "/:id/applications",
  authenticate,
  validate({
    body: emptyObjectSchema,
    query: applicationListQuerySchema,
    params: jobIdParamsSchema,
  }),
  getJobApplications,
);
router.post(
  "/:id/applications",
  authenticate,
  rateLimiters.write,
  validate({
    body: applicationCreateSchema,
    query: emptyObjectSchema,
    params: jobIdParamsSchema,
  }),
  postApplication,
);
router.get(
  "/:id",
  validate({
    body: emptyObjectSchema,
    query: emptyObjectSchema,
    params: jobIdParamsSchema,
  }),
  getJobById,
);
router.put(
  "/:id",
  authenticate,
  rateLimiters.write,
  validate({
    body: jobUpdateSchema,
    query: emptyObjectSchema,
    params: jobIdParamsSchema,
  }),
  putJob,
);
router.delete(
  "/:id",
  authenticate,
  rateLimiters.write,
  validate({
    body: emptyObjectSchema,
    query: emptyObjectSchema,
    params: jobIdParamsSchema,
  }),
  removeJob,
);

export default router;
