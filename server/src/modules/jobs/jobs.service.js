import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from "../../utils/AppError.js";
import { DEFAULT_PAGE_SIZE } from "../../utils/pagination.js";
import {
  findJobOwners,
  findJobs,
  findJobsByOwner,
  findJob,
  createJob,
  updateJob,
  softDeleteJob,
} from "./jobs.repository.js";

const createRoles = new Set(["client", "admin"]);

export function buildJobSearchKeywords(job) {
  const tokens =
    [
      job.title,
      job.description,
      job.additionalDetails,
      job.category,
      job.jobType,
      job.projectDuration,
      job.workMode,
      job.location,
      ...(job.skills ?? []),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .match(/[\p{L}\p{N}]+/gu) ?? [];
  return [...new Set(tokens)].slice(0, 300);
}

function withOwner(job, owners) {
  return {
    ...job,
    ownerSummary: owners.get(job.postedBy) ?? {},
  };
}

export async function listJobs(filters) {
  const page = await findJobs({
    ...filters,
    limit: filters.limit ?? DEFAULT_PAGE_SIZE,
  });
  const owners = await findJobOwners(page.items);
  return {
    ...page,
    items: page.items.map((job) => withOwner(job, owners)),
  };
}

export async function listMyJobs(actor, filters) {
  const page = await findJobsByOwner(actor.uid, {
    limit: filters.limit ?? DEFAULT_PAGE_SIZE,
    cursor: filters.cursor,
  });
  return page;
}

export async function getJob(id) {
  const job = await findJob(id);
  if (!job || job.status === "deleted") {
    throw new NotFoundError("Job not found");
  }
  const owners = await findJobOwners([job]);
  return withOwner(job, owners);
}

export async function createNewJob(actor, input) {
  if (!createRoles.has(actor.role)) {
    throw new ForbiddenError("Only clients and admins can post jobs");
  }
  const job = await createJob(actor.uid, input, buildJobSearchKeywords(input));
  const owners = await findJobOwners([job]);
  return withOwner(job, owners);
}

export async function updateExistingJob(actor, id, updates) {
  const existing = await findJob(id);
  if (!existing || existing.status === "deleted") {
    throw new NotFoundError("Job not found");
  }
  if (actor.uid !== existing.postedBy && actor.role !== "admin") {
    throw new ForbiddenError();
  }

  const keywordsChanged =
    updates.title !== undefined ||
    updates.description !== undefined ||
    updates.additionalDetails !== undefined ||
    updates.category !== undefined ||
    updates.jobType !== undefined ||
    updates.projectDuration !== undefined ||
    updates.workMode !== undefined ||
    updates.location !== undefined ||
    updates.skills !== undefined;
  const resultingJob = { ...existing, ...updates };
  if (resultingJob.budgetMin > resultingJob.budgetMax) {
    throw new ConflictError("Job budget minimum cannot exceed its maximum");
  }
  const job = await updateJob(
    id,
    updates,
    keywordsChanged ? buildJobSearchKeywords(resultingJob) : undefined,
  );
  if (!job) throw new NotFoundError("Job not found");
  const owners = await findJobOwners([job]);
  return withOwner(job, owners);
}

export async function deleteExistingJob(actor, id) {
  const existing = await findJob(id);
  if (!existing || existing.status === "deleted") {
    throw new NotFoundError("Job not found");
  }
  if (actor.uid !== existing.postedBy && actor.role !== "admin") {
    throw new ForbiddenError();
  }
  if (!(await softDeleteJob(id))) throw new NotFoundError("Job not found");
}
