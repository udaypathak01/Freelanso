function toIsoString(value) {
  if (value && typeof value.toDate === "function") {
    return value.toDate().toISOString();
  }
  if (value instanceof Date) return value.toISOString();
  return null;
}

export function toApplicationDto(application, related = {}) {
  const dto = {
    id: application.id,
    jobId: application.jobId,
    applicantId: application.applicantId,
    coverLetter: application.coverLetter,
    proposedRate: application.proposedRate,
    status: application.status,
    createdAt: toIsoString(application.createdAt),
    updatedAt: toIsoString(application.updatedAt),
  };
  if (related.job) {
    dto.job = {
      id: related.job.id,
      title: related.job.title,
      status: related.job.status,
    };
  }
  if (related.applicant) {
    dto.applicant = {
      id: application.applicantId,
      displayName:
        typeof related.applicant.displayName === "string"
          ? related.applicant.displayName
          : "Freelancer",
      photoURL:
        typeof related.applicant.photoURL === "string"
          ? related.applicant.photoURL
          : null,
    };
  }
  return dto;
}
