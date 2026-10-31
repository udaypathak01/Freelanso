import { Router } from "express";
import { authenticate } from "../../middleware/auth.js";
import { rateLimiters } from "../../middleware/rateLimit.js";
import { validate } from "../../middleware/validate.js";
import { z } from "zod";
import { emptyObjectSchema } from "../users/users.schema.js";
import { signUpload } from "./uploads.controller.js";

const router = Router();
const uploadSignatureSchema = z
  .object({
    purpose: z.enum(["profile", "project", "battle"]).default("profile"),
    resourceType: z.enum(["image", "video"]).optional(),
  })
  .strict()
  .refine(
    ({ purpose, resourceType }) =>
      purpose === "profile" || purpose === "battle"
        ? resourceType === undefined || resourceType === "image"
        : resourceType !== undefined,
    "Project uploads must specify an image or video resource type",
  );

router.post(
  "/sign",
  authenticate,
  rateLimiters.write,
  validate({
    body: uploadSignatureSchema,
    query: emptyObjectSchema,
    params: emptyObjectSchema,
  }),
  signUpload,
);

export default router;
