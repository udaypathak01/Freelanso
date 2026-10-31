import { Router } from "express";
import { authenticate } from "../../middleware/auth.js";
import { authenticateOptional } from "../../middleware/authOptional.js";
import { rateLimiters } from "../../middleware/rateLimit.js";
import { validate } from "../../middleware/validate.js";
import {
  commentCreateSchema,
  commentParamsSchema,
  commentsQuerySchema,
  emptyObjectSchema,
  projectCreateSchema,
  projectIdParamsSchema,
  projectListQuerySchema,
  projectUpdateSchema,
} from "./projects.schema.js";
import {
  deleteComment,
  deleteProject,
  getComments,
  getMyProjects,
  getProjectById,
  getProjects,
  postComment,
  postLike,
  postProject,
  putProject,
} from "./projects.controller.js";

const router = Router();

router.get(
  "/",
  validate({
    body: emptyObjectSchema,
    query: projectListQuerySchema,
    params: emptyObjectSchema,
  }),
  getProjects,
);
router.get(
  "/mine",
  authenticate,
  rateLimiters.write,
  validate({
    body: emptyObjectSchema,
    query: commentsQuerySchema,
    params: emptyObjectSchema,
  }),
  getMyProjects,
);
router.post(
  "/",
  authenticate,
  rateLimiters.write,
  validate({
    body: projectCreateSchema,
    query: emptyObjectSchema,
    params: emptyObjectSchema,
  }),
  postProject,
);
router.get(
  "/:id/comments",
  validate({
    body: emptyObjectSchema,
    query: commentsQuerySchema,
    params: projectIdParamsSchema,
  }),
  getComments,
);
router.post(
  "/:id/comments",
  authenticate,
  rateLimiters.write,
  validate({
    body: commentCreateSchema,
    query: emptyObjectSchema,
    params: projectIdParamsSchema,
  }),
  postComment,
);
router.delete(
  "/:id/comments/:commentId",
  authenticate,
  rateLimiters.write,
  validate({
    body: emptyObjectSchema,
    query: emptyObjectSchema,
    params: commentParamsSchema,
  }),
  deleteComment,
);
router.post(
  "/:id/like",
  authenticate,
  rateLimiters.social,
  validate({
    body: emptyObjectSchema,
    query: emptyObjectSchema,
    params: projectIdParamsSchema,
  }),
  postLike,
);
router.get(
  "/:id",
  authenticateOptional,
  validate({
    body: emptyObjectSchema,
    query: emptyObjectSchema,
    params: projectIdParamsSchema,
  }),
  getProjectById,
);
router.put(
  "/:id",
  authenticate,
  rateLimiters.write,
  validate({
    body: projectUpdateSchema,
    query: emptyObjectSchema,
    params: projectIdParamsSchema,
  }),
  putProject,
);
router.delete(
  "/:id",
  authenticate,
  rateLimiters.write,
  validate({
    body: emptyObjectSchema,
    query: emptyObjectSchema,
    params: projectIdParamsSchema,
  }),
  deleteProject,
);

export default router;
