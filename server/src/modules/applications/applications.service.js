import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from "../../utils/AppError.js";
import { DEFAULT_PAGE_SIZE } from "../../utils/pagination.js";
import {
  createApplication,
  findApplicants,
  findApplication,
  findApplicationJobs,
  findApplicationsForApplicant,
  findApplicationsForJob,
  updateApplicationStatus,
} from "./applications.repository.js";
import { findJob } from "../jobs/jobs.repository.js";
import { notifyUser } from "../notifications/notifications.service.js";

const ownerTransitions = new Set(["shortlisted", "rejected", "hired"]);
const applicantTransitions = new Set(["withdrawn"]);

export function canTransitionApplication(actor, application, nextStatus) {
  if (actor.uid === application.jobOwnerId) {
    return (
      application.status === "submitted" && ownerTransitions.has(nextStatus)
    );
  }
  if (actor.uid === application.applicantId) {
    return (
      ["submitted", "shortlisted"].includes(application.status) &&
      applicantTransitions.has(nextStatus)
    );
  }
  return false;
}

export async function submitApplication(actor, jobId, input) {
  if (actor.role !== "freelancer") {
    throw new ForbiddenError("Only freelancers can apply to jobs");
  }
  const result = await createApplication(jobId, actor.uid, input);
  switch (result.reason) {
    case "job_not_found":
      throw new NotFoundError("Job not found");
    case "own_job":
      throw new ForbiddenError("You cannot apply to your own job");
    case "job_not_open":
      throw new ConflictError("This job is not accepting applications");
    case "duplicate":
      throw new ConflictError("You have already applied to this job");
    case "created":
      await notifyUser(
        result.application.jobOwnerId,
        {
          type: "application",
          title: "New job application",
          body: `${actor.displayName || "A freelancer"} applied for your job`,
          href: `/jobs/${encodeURIComponent(jobId)}`,
          actorUid: actor.uid,
          actorName: actor.displayName || "Freelanso member",
          createdAt: Date.now(),
          readAt: null,
        },
        result.application.id,
      );
      return result.application;
    default:
      throw new Error("Job application could not be created");
  }
}

export async function listMyApplications(actor, query) {
  const page = await findApplicationsForApplicant(actor.uid, {
    limit: query.limit ?? DEFAULT_PAGE_SIZE,
    cursor: query.cursor,
  });
  const jobs = await findApplicationJobs(page.items);
  return {
    ...page,
    items: page.items.map((application) => ({
      application,
      job: jobs.get(application.jobId),
    })),
  };
}

export async function listJobApplications(actor, jobId, query) {
  const job = await findJob(jobId);
  if (!job || job.status === "deleted") {
    throw new NotFoundError("Job not found");
  }
  if (actor.uid !== job.postedBy) throw new ForbiddenError();

  const page = await findApplicationsForJob(jobId, {
    limit: query.limit ?? DEFAULT_PAGE_SIZE,
    cursor: query.cursor,
  });
  const applicants = await findApplicants(page.items);
  return {
    ...page,
    items: page.items.map((application) => ({
      application,
      applicant: applicants.get(application.applicantId),
    })),
  };
}

export async function changeApplicationStatus(actor, id, status) {
  const application = await findApplication(id);
  if (!application) throw new NotFoundError("Application not found");
  if (
    actor.uid !== application.jobOwnerId &&
    actor.uid !== application.applicantId
  ) {
    throw new ForbiddenError();
  }
  if (!canTransitionApplication(actor, application, status)) {
    throw new ConflictError(
      "The requested application status transition is not allowed",
    );
  }
  const updated = await updateApplicationStatus(id, application.status, status);
  if (!updated) {
    throw new ConflictError("The application status changed; reload and retry");
  }
  const recipientUid =
    actor.uid === updated.jobOwnerId ? updated.applicantId : updated.jobOwnerId;
  const notificationCopy = {
    shortlisted: {
      title: "Application shortlisted",
      body: "The client shortlisted your application",
    },
    rejected: {
      title: "Application rejected",
      body: "The client rejected your application",
    },
    hired: {
      title: "You've been hired!",
      body: "The client hired you for this job",
    },
    withdrawn: {
      title: "Application withdrawn",
      body: `${actor.displayName || "A freelancer"} withdrew their application`,
    },
  }[updated.status];
  await notifyUser(
    recipientUid,
    {
      type: "application_status",
      ...notificationCopy,
      href: `/jobs/${encodeURIComponent(updated.jobId)}`,
      actorUid: actor.uid,
      actorName: actor.displayName || "Freelanso member",
      createdAt: Date.now(),
      readAt: null,
    },
    `${id}:${updated.status}`,
  );
  return updated;
}
