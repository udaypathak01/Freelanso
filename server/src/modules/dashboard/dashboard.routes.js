import { Router } from "express";
import { authenticate } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import {
  dashboardEmptySchema,
  dashboardQuerySchema,
} from "./dashboard.schema.js";
import { getDashboardHandler } from "./dashboard.controller.js";

const router = Router();

router.get(
  "/",
  authenticate,
  validate({
    body: dashboardEmptySchema,
    query: dashboardQuerySchema,
    params: dashboardEmptySchema,
  }),
  getDashboardHandler,
);

export default router;
