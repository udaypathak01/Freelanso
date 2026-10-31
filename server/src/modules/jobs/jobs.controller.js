import { asyncHandler } from "../../utils/asyncHandler.js";
import { created, noContent, ok, paginated } from "../../utils/response.js";
import { DEFAULT_PAGE_SIZE } from "../../utils/pagination.js";
import { toJobDto } from "./jobs.mapper.js";
import {
  createNewJob,
  deleteExistingJob,
  getJob,
  listJobs,
  listMyJobs,
  updateExistingJob,
} from "./jobs.service.js";

const jobDto = (job) => toJobDto(job.id, job, job.ownerSummary);

export const getJobs = asyncHandler(async (req, res) => {
  const filters = req.validated.query;
  const page = await listJobs(filters);
  return paginated(res, page.items.map(jobDto), page.nextCursor, {
    ...(page.total !== undefined ? { total: page.total } : {}),
    limit: filters.limit ?? DEFAULT_PAGE_SIZE,
    appliedFilters: {
      q: filters.q ?? "",
      category: filters.category ?? null,
      skills: filters.skills ?? [],
      minPrice: filters.minPrice ?? null,
      maxPrice: filters.maxPrice ?? null,
      jobType: filters.jobType ?? null,
      location: filters.location ?? null,
      sort: filters.sort,
    },
  });
});

export const getMyJobs = asyncHandler(async (req, res) => {
  const filters = req.validated.query;
  const page = await listMyJobs(req.user, filters);
  return paginated(
    res,
    page.items.map(jobDto),
    page.nextCursor,
    { limit: filters.limit ?? DEFAULT_PAGE_SIZE },
  );
});

export const getJobById = asyncHandler(async (req, res) =>
  ok(res, jobDto(await getJob(req.validated.params.id))),
);

export const postJob = asyncHandler(async (req, res) =>
  created(res, jobDto(await createNewJob(req.user, req.validated.body))),
);

export const putJob = asyncHandler(async (req, res) =>
  ok(
    res,
    jobDto(
      await updateExistingJob(
        req.user,
        req.validated.params.id,
        req.validated.body,
      ),
    ),
  ),
);

export const removeJob = asyncHandler(async (req, res) => {
  await deleteExistingJob(req.user, req.validated.params.id);
  return noContent(res);
});
