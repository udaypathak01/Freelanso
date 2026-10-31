import { describe, expect, it } from "vitest";
import { matchingWeights } from "../src/config/matching.js";
import { scoreFreelancerForProject } from "../src/modules/matches/matches.scoring.js";

describe("deterministic freelancer matching", () => {
  const now = Date.parse("2026-10-27T00:00:00.000Z");
  const project = {
    skills: ["React", "Accessibility"],
    tags: ["frontend"],
    category: "web-development",
    price: 100,
  };
  const freelancer = {
    id: "freelancer-1",
    skills: ["react", "Frontend"],
    headline: "Web developer",
    hourlyRate: 50,
    updatedAt: new Date("2026-10-20T00:00:00.000Z"),
    stats: { ratingAvg: 4, ratingCount: 3, projectsCount: 2 },
  };

  it("uses configured factors and remains stable for the same inputs", () => {
    const first = scoreFreelancerForProject(project, freelancer, { now });
    const second = scoreFreelancerForProject(project, freelancer, { now });
    expect(first).toEqual(second);
    expect(first.matchScore).toBeGreaterThan(0);
    expect(first.breakdown.skillMatch).toBe(33);
    expect(first.breakdown.pastWorkRelevance).toBe(35);
    expect(first.breakdown.ratingFit).toBe(80);
    expect(
      Object.values(matchingWeights).reduce((sum, weight) => sum + weight, 0),
    ).toBe(1);
  });

  it("handles absent ratings and profile timestamps without unstable values", () => {
    const result = scoreFreelancerForProject(
      project,
      {
        id: "new",
        skills: ["react", "accessibility", "frontend"],
        headline: "Web developer",
        stats: { projectsCount: 0 },
      },
      { now },
    );
    expect(result.isNewTalent).toBe(true);
    expect(Number.isInteger(result.matchScore)).toBe(true);
    expect(result.breakdown.skillMatch).toBe(70);
    expect(result.breakdown.pastWorkRelevance).toBe(0);
    expect(result.breakdown.bioRelevance).toBe(30);
    expect(result.breakdown.ratingFit).toBe(50);
    expect(result.breakdown.recencyFit).toBe(50);
  });
});
