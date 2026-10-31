import { Router } from "express";
import { z } from "zod";
import { validate } from "../../middleware/validate.js";
import { getLiveness, getReadiness } from "./health.controller.js";

const emptySchema = z.object({}).strict();
const router = Router();
const validateEmpty = validate({
  body: emptySchema,
  query: emptySchema,
  params: emptySchema,
});

router.get("/healthz", validateEmpty, getLiveness);
router.get("/readyz", validateEmpty, getReadiness);

export default router;
