import { matchingWeights } from "../../config/matching.js";

function normalizedTokens(values) {
  return new Set(
    values
      .filter((value) => typeof value === "string")
      .join(" ")
      .normalize("NFKC")
      .toLowerCase()
      .match(/[\p{L}\p{N}]+/gu) ?? [],
  );
}

function skillOverlap(projectSkills, candidateSkills) {
  const requested = normalizedTokens(projectSkills);
  const available = normalizedTokens(candidateSkills);
  if (!requested.size) return 0;
  let matches = 0;
  for (const skill of requested) {
    if (available.has(skill)) matches += 1;
  }
  return matches / requested.size;
}

function recencyFit(value, now) {
  const date =
    typeof value?.toDate === "function"
      ? value.toDate()
      : value instanceof Date
        ? value
        : new Date(value);
  if (!Number.isFinite(date.getTime())) return 0.5;
  const ageDays = Math.max(0, (now - date.getTime()) / 86_400_000);
  if (ageDays <= 30) return 1;
  if (ageDays <= 180) return 0.75;
  if (ageDays <= 365) return 0.5;
  return 0.25;
}

export function scoreFreelancerForProject(
  project,
  freelancer,
  { now = Date.now(), weights = matchingWeights } = {},
) {
  const projectSkills = [...(project.skills ?? []), ...(project.tags ?? [])];
  const skill = skillOverlap(projectSkills, freelancer.skills ?? []);
  const categoryTokens = normalizedTokens([project.category]);
  const profileTokens = normalizedTokens([
    freelancer.headline ?? "",
    freelancer.bio ?? "",
    ...(freelancer.skills ?? []),
  ]);
  const category =
    [...categoryTokens].some((token) => profileTokens.has(token)) ? 1 : 0;
  const projectBudget = Number.isFinite(project.price) ? project.price : null;
  const hourlyRate = Number.isFinite(freelancer.hourlyRate)
    ? freelancer.hourlyRate
    : null;
  const budget =
    projectBudget === null || hourlyRate === null || hourlyRate === 0
      ? 0.5
      : Math.min(1, projectBudget / hourlyRate);
  const ratingCount = freelancer.stats?.ratingCount ?? 0;
  const rating =
    ratingCount > 0
      ? Math.max(0, Math.min(1, (freelancer.stats?.ratingAvg ?? 0) / 5))
      : 0.5;
  const recency = recencyFit(freelancer.updatedAt, now);
  const isNewTalent = (freelancer.stats?.projectsCount ?? 0) === 0;
  const score =
    skill * weights.skillOverlap +
    category * weights.categoryMatch +
    budget * weights.budgetFit +
    rating * weights.rating +
    recency * weights.recency;

  const breakdown = {
    skillMatch: Math.round(skill * (isNewTalent ? 70 : 50)),
    pastWorkRelevance: isNewTalent ? 0 : Math.round(budget * 35),
    bioRelevance: Math.round(category * (isNewTalent ? 30 : 15)),
    ratingFit: Math.round(rating * 100),
    recencyFit: Math.round(recency * 100),
  };
  const reason =
    skill >= 0.7
      ? "Strong overlap between the project's required skills and this freelancer's profile."
      : skill > 0
        ? "Some of the project's required skills match this freelancer's profile."
        : "This freelancer's listed skills do not directly overlap the project's requirements.";
  const tip =
    skill < 0.5
      ? "Add relevant project skills to your profile to improve future matches."
      : null;

  return {
    freelancerId: freelancer.id,
    matchScore: Math.round(score * 100),
    breakdown,
    isNewTalent,
    reason,
    tip,
  };
}
