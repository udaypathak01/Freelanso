import { asyncHandler } from "../../utils/asyncHandler.js";
import { created, noContent, ok, paginated } from "../../utils/response.js";
import {
  addProjectComment,
  createNewProject,
  deleteExistingProject,
  getProject,
  likeProject,
  listMyProjects,
  listProjectComments,
  listProjects,
  removeProjectComment,
  updateExistingProject,
} from "./projects.service.js";
import { toCommentDto, toProjectDto } from "./projects.mapper.js";
import { findProjectOwners } from "./projects.repository.js";
import { DEFAULT_PAGE_SIZE } from "../../utils/pagination.js";

function projectDto(project) {
  return toProjectDto(project.id, project, project.ownerSummary);
}

export const getProjects = asyncHandler(async (req, res) => {
  const filters = req.validated.query;
  const page = await listProjects(filters);
  return paginated(res, page.items.map(projectDto), page.nextCursor, {
    ...(page.total !== undefined ? { total: page.total } : {}),
    limit: filters.limit ?? DEFAULT_PAGE_SIZE,
    appliedFilters: {
      q: filters.q ?? "",
      category: filters.category ?? null,
      skills: filters.skills ?? [],
      minPrice: filters.minPrice ?? null,
      maxPrice: filters.maxPrice ?? null,
      sort: filters.sort,
    },
  });
});

export const getMyProjects = asyncHandler(async (req, res) => {
  const page = await listMyProjects(req.user, req.validated.query);
  return paginated(res, page.items.map(projectDto), page.nextCursor);
});

export const getProjectById = asyncHandler(async (req, res) => {
  const project = await getProject(req.validated.params.id, req.user, req.ip);
  return ok(res, projectDto(project));
});

export const postProject = asyncHandler(async (req, res) => {
  const project = await createNewProject(req.user, req.validated.body);
  return created(res, projectDto(project));
});

export const putProject = asyncHandler(async (req, res) => {
  const project = await updateExistingProject(
    req.user,
    req.validated.params.id,
    req.validated.body,
  );
  return ok(res, projectDto(project));
});

export const deleteProject = asyncHandler(async (req, res) => {
  await deleteExistingProject(req.user, req.validated.params.id, req.id);
  return noContent(res);
});

export const postLike = asyncHandler(async (req, res) => {
  return ok(res, await likeProject(req.user, req.validated.params.id));
});

export const getComments = asyncHandler(async (req, res) => {
  const page = await listProjectComments(
    req.validated.params.id,
    req.validated.query,
  );
  return paginated(
    res,
    page.items.map((comment) =>
      toCommentDto(comment.id, comment, comment.author),
    ),
    page.nextCursor,
  );
});

export const postComment = asyncHandler(async (req, res) => {
  const comment = await addProjectComment(
    req.user,
    req.validated.params.id,
    req.validated.body.text,
  );
  const authors = await findProjectOwners([{ ownerId: comment.authorId }]);
  return created(
    res,
    toCommentDto(comment.id, comment, authors.get(comment.authorId)),
  );
});

export const deleteComment = asyncHandler(async (req, res) => {
  await removeProjectComment(
    req.user,
    req.validated.params.id,
    req.validated.params.commentId,
  );
  return noContent(res);
});
