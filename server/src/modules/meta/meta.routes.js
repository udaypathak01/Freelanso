import { Router } from "express";
import { validate } from "../../middleware/validate.js";
import { ok } from "../../utils/response.js";
import { serviceCategories } from "../services/serviceCategories.js";
import { emptyObjectSchema } from "../services/services.schema.js";

const router = Router();

router.get(
  "/categories",
  validate({
    body: emptyObjectSchema,
    query: emptyObjectSchema,
    params: emptyObjectSchema,
  }),
  (req, res) => ok(res, serviceCategories),
);

export default router;
