function toIsoString(value) {
  if (value && typeof value.toDate === "function") {
    return value.toDate().toISOString();
  }
  if (value instanceof Date) return value.toISOString();
  return null;
}

export function toJobDto(id, job, owner = {}) {
  const displayName =
    typeof owner.displayName === "string" && owner.displayName.trim()
      ? owner.displayName
      : "Client";
  return {
    id,
    postedBy: job.postedBy,
    owner: {
      id: job.postedBy,
      displayName,
      photoURL: typeof owner.photoURL === "string" ? owner.photoURL : null,
    },
    title: job.title,
    description: job.description,
    category: job.category,
    skills: Array.isArray(job.skills) ? job.skills : [],
    budgetMin: Number.isFinite(job.budgetMin) ? job.budgetMin : 0,
    budgetMax: Number.isFinite(job.budgetMax) ? job.budgetMax : 0,
    budgetType: job.budgetType === "hourly" ? "hourly" : "fixed",
    jobType: job.jobType,
    projectDuration:
      typeof job.projectDuration === "string" ? job.projectDuration : null,
    deadlineDays:
      Number.isInteger(job.deadlineDays) && job.deadlineDays > 0
        ? job.deadlineDays
        : null,
    deadlineDate:
      typeof job.deadlineDate === "string" ? job.deadlineDate : null,
    experienceLevel:
      ["entry", "intermediate", "expert"].includes(job.experienceLevel)
        ? job.experienceLevel
        : null,
    workMode: ["remote", "hybrid", "onsite"].includes(job.workMode)
      ? job.workMode
      : null,
    additionalDetails:
      typeof job.additionalDetails === "string" ? job.additionalDetails : null,
    location: typeof job.location === "string" ? job.location : null,
    status: job.status,
    applicationsCount:
      Number.isInteger(job.applicationsCount) && job.applicationsCount >= 0
        ? job.applicationsCount
        : 0,
    createdAt: toIsoString(job.createdAt),
    updatedAt: toIsoString(job.updatedAt),
  };
}
