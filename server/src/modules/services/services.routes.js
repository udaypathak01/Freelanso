import { Router } from "express";
import { authenticate } from "../../middleware/auth.js";
import { rateLimiters } from "../../middleware/rateLimit.js";
import { validate } from "../../middleware/validate.js";
import {
  emptyObjectSchema,
  serviceCreateSchema,
  serviceIdParamsSchema,
  serviceListQuerySchema,
  serviceUpdateSchema,
} from "./services.schema.js";
import {
  getServiceById,
  getServices,
  postService,
  putService,
  removeService,
} from "./services.controller.js";

const router = Router();

router.get(
  "/",
  validate({
    body: emptyObjectSchema,
    query: serviceListQuerySchema,
    params: emptyObjectSchema,
  }),
  getServices,
);
router.post(
  "/",
  authenticate,
  rateLimiters.write,
  validate({
    body: serviceCreateSchema,
    query: emptyObjectSchema,
    params: emptyObjectSchema,
  }),
  postService,
);
router.get(
  "/:id",
  validate({
    body: emptyObjectSchema,
    query: emptyObjectSchema,
    params: serviceIdParamsSchema,
  }),
  getServiceById,
);
router.put(
  "/:id",
  authenticate,
  rateLimiters.write,
  validate({
    body: serviceUpdateSchema,
    query: emptyObjectSchema,
    params: serviceIdParamsSchema,
  }),
  putService,
);
router.delete(
  "/:id",
  authenticate,
  rateLimiters.write,
  validate({
    body: emptyObjectSchema,
    query: emptyObjectSchema,
    params: serviceIdParamsSchema,
  }),
  removeService,
);

export default router;
