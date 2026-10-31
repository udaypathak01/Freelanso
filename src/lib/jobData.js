import { auth } from "./firebase";
import { marketplaceApi } from "./data";

export async function fetchJobsPage(filters = {}) {
  const query = new URLSearchParams({ limit: String(filters.limit ?? 6) });
  for (const key of [
    "q",
    "category",
    "skills",
    "minPrice",
    "maxPrice",
    "jobType",
    "location",
    "sort",
    "cursor",
  ]) {
    if (filters[key] !== undefined && filters[key] !== "") {
      query.set(key, String(filters[key]));
    }
  }
  const result = await marketplaceApi(`/jobs?${query.toString()}`, {
    signal: filters.signal,
  });
  return { items: result.data, meta: result.meta };
}

export async function fetchJob(id, options = {}) {
  const result = await marketplaceApi(`/jobs/${encodeURIComponent(id)}`, {
    signal: options.signal,
  });
  return result.data;
}

export async function applyToJob(id, application) {
  const result = await marketplaceApi(
    `/jobs/${encodeURIComponent(id)}/applications`,
    { method: "POST", body: JSON.stringify(application) },
    true,
  );
  return result.data;
}

export function isAuthenticated() {
  return Boolean(auth.currentUser);
}
