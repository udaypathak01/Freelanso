import { createHash } from "node:crypto";
import { logger } from "../../config/logger.js";
import { toProjectDto } from "../projects/projects.mapper.js";
import { listProjects } from "../projects/projects.service.js";
import { geminiAIProvider } from "./geminiAIProvider.js";
import { normalizeSearchTokens, searchProvider } from "./searchProvider.js";
import { consumeDailySearchQuota } from "./smartSearch.repository.js";

const CANDIDATE_LIMIT = 50;
const AI_CANDIDATE_LIMIT = 10;
const CACHE_TTL_MS = 30_000;
const CACHE_MAX_ENTRIES = 500;
const responseCache = new Map();

function cacheKey(uid, input, candidateIds) {
  return createHash("sha256")
    .update(
      JSON.stringify({
        uid,
        query: input.query,
        filters: input.filters ?? {},
        candidateIds,
      }),
    )
    .digest("hex");
}

function candidateDto(project) {
  return toProjectDto(project.id, project, project.ownerSummary);
}

function deterministicRanking(projects, terms) {
  return searchProvider.rank(projects, terms);
}

function remember(key, result, now = Date.now()) {
  responseCache.set(key, { result, expiresAt: now + CACHE_TTL_MS });
  if (responseCache.size > CACHE_MAX_ENTRIES) {
    const oldestKey = responseCache.keys().next().value;
    if (oldestKey) responseCache.delete(oldestKey);
  }
}

function recall(key, now = Date.now()) {
  const cached = responseCache.get(key);
  if (!cached) return null;
  if (cached.expiresAt <= now) {
    responseCache.delete(key);
    return null;
  }
  return cached.result;
}

export function createSmartSearchService({
  provider = geminiAIProvider,
  projectLister = listProjects,
  quotaConsumer = consumeDailySearchQuota,
  log = logger,
} = {}) {
  return {
    async search(actor, input, requestId) {
      const filters = input.filters ?? {};
      const quota = await quotaConsumer(actor.uid);
      const page = await projectLister({
        q: input.query,
        category: filters.category,
        skills: filters.skills,
        minPrice: filters.minPrice,
        maxPrice: filters.maxPrice,
        sort: filters.sort ?? "newest",
        limit: CANDIDATE_LIMIT,
        cursor: undefined,
      });
      const candidates = page.items.map(candidateDto);
      const terms = normalizeSearchTokens(input.query);
      const fallback = deterministicRanking(candidates, terms);
      const ids = candidates.map(({ id }) => id);
      const key = cacheKey(actor.uid, input, ids);
      const cached = recall(key);
      if (cached) {
        return {
          ...cached,
          meta: {
            ...cached.meta,
            cached: true,
            remainingDailyQuota: quota.remaining,
          },
        };
      }

      if (!candidates.length) {
        const result = {
          items: [],
          meta: {
            degraded: false,
            cached: false,
            candidateCount: 0,
            remainingDailyQuota: quota.remaining,
          },
        };
        remember(key, result);
        return result;
      }

      let rankedIds;
      let degraded = false;
      const startedAt = Date.now();
      const aiCandidates = fallback.slice(0, AI_CANDIDATE_LIMIT).map(
        ({ id, title, description, category, skills, tags }) => ({
          id,
          title: typeof title === "string" ? title.slice(0, 120) : "",
          description:
            typeof description === "string" ? description.slice(0, 250) : "",
          category: typeof category === "string" ? category.slice(0, 80) : "",
          skills: Array.isArray(skills)
            ? skills
                .filter((skill) => typeof skill === "string")
                .slice(0, 10)
                .map((skill) => skill.slice(0, 40))
            : [],
          tags: Array.isArray(tags)
            ? tags
                .filter((tag) => typeof tag === "string")
                .slice(0, 10)
                .map((tag) => tag.slice(0, 40))
            : [],
        }),
      );
      try {
        rankedIds = await provider.rankCandidates({
          query: input.query,
          candidates: aiCandidates,
          requestId,
        });
        const candidateIds = new Set(aiCandidates.map(({ id }) => id));
        if (
          !Array.isArray(rankedIds) ||
          new Set(rankedIds).size !== rankedIds.length ||
          rankedIds.some((id) => !candidateIds.has(id))
        ) {
          throw new Error("AI ranking failed candidate ID validation");
        }
      } catch {
        degraded = true;
        log.warn(
          {
            requestId,
            provider: "gemini",
            latencyMs: Date.now() - startedAt,
            providerFailure: true,
            inputCharacters: input.query.length,
          },
          "Smart search using deterministic fallback",
        );
        rankedIds = fallback.map(({ id }) => id);
      }

      const byId = new Map(candidates.map((candidate) => [candidate.id, candidate]));
      const ranked = [
        ...rankedIds.map((id) => byId.get(id)),
        ...fallback.filter(({ id }) => !rankedIds.includes(id)),
      ].filter(Boolean);
      const result = {
        items: ranked,
        meta: {
          degraded,
          cached: false,
          candidateCount: candidates.length,
          remainingDailyQuota: quota.remaining,
        },
      };
      remember(key, result);
      return result;
    },
  };
}

export const smartSearchService = createSmartSearchService();
