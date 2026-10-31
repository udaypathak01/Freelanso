import { ForbiddenError, NotFoundError } from "../../utils/AppError.js";
import { toPublicUserDto } from "../users/users.mapper.js";
import {
  findFreelancerMatchCandidates,
  findMatchTargetProject,
} from "./matches.repository.js";
import { scoreFreelancerForProject } from "./matches.scoring.js";

function toFreelancerMatchDto(uid, user) {
  const publicProfile = toPublicUserDto(uid, user);
  return {
    id: uid,
    name: publicProfile.displayName || "Talent Profile",
    avatar: publicProfile.photoURL,
    skills: publicProfile.skills,
  };
}

export async function scoreProjectMatches(actor, projectId) {
  const project = await findMatchTargetProject(projectId);
  if (!project || project.status === "archived") {
    throw new NotFoundError("Project not found");
  }
  if (actor.uid !== project.ownerId && actor.role !== "admin") {
    throw new ForbiddenError();
  }

  const candidates = await findFreelancerMatchCandidates();
  const matches = candidates
    .map((freelancer) => ({
      ...scoreFreelancerForProject(project, freelancer),
      freelancer: toFreelancerMatchDto(freelancer.id, freelancer),
    }))
    .sort(
      (left, right) =>
        right.matchScore - left.matchScore ||
        left.freelancerId.localeCompare(right.freelancerId),
    );
  return { matches, candidateCount: candidates.length };
}
