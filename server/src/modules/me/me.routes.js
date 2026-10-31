import { Router } from "express";
import { z } from "zod";
import { authenticate } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { getMe } from "./me.controller.js";

const emptySchema = z.object({}).strict();
const router = Router();

router.get(
  "/",
  authenticate,
  validate({ body: emptySchema, query: emptySchema, params: emptySchema }),
  getMe,
);

export default router;
