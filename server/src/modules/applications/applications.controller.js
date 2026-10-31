import { asyncHandler } from "../../utils/asyncHandler.js";
import { created, ok, paginated } from "../../utils/response.js";
import { DEFAULT_PAGE_SIZE } from "../../utils/pagination.js";
import { toApplicationDto } from "./applications.mapper.js";
import {
  changeApplicationStatus,
  listJobApplications,
  listMyApplications,
  submitApplication,
} from "./applications.service.js";

export const postApplication = asyncHandler(async (req, res) => {
  const application = await submitApplication(
    req.user,
    req.validated.params.id,
    req.validated.body,
  );
  return created(res, toApplicationDto(application));
});

export const getMyApplications = asyncHandler(async (req, res) => {
  const filters = req.validated.query;
  const page = await listMyApplications(req.user, filters);
  return paginated(
    res,
    page.items.map(({ application, job }) =>
      toApplicationDto(application, { job: job ?? null }),
    ),
    page.nextCursor,
    {
      total: page.total,
      limit: filters.limit ?? DEFAULT_PAGE_SIZE,
    },
  );
});

export const getJobApplications = asyncHandler(async (req, res) => {
  const filters = req.validated.query;
  const page = await listJobApplications(
    req.user,
    req.validated.params.id,
    filters,
  );
  return paginated(
    res,
    page.items.map(({ application, applicant }) =>
      toApplicationDto(application, { applicant: applicant ?? null }),
    ),
    page.nextCursor,
    {
      total: page.total,
      limit: filters.limit ?? DEFAULT_PAGE_SIZE,
    },
  );
});

export const patchApplicationStatus = asyncHandler(async (req, res) =>
  ok(
    res,
    toApplicationDto(
      await changeApplicationStatus(
        req.user,
        req.validated.params.id,
        req.validated.body.status,
      ),
    ),
  ),
);
