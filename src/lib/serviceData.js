import { apiRequest } from "./api";

const PLACEHOLDER_IMG =
  "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=1000&auto=format&fit=crop";

function toServiceView(service) {
  const image = service.images?.[0]?.url || PLACEHOLDER_IMG;
  return {
    ...service,
    authorUid: service.ownerId,
    author: {
      name: service.owner?.displayName || "Freelancer",
      avatar: service.owner?.photoURL || PLACEHOLDER_IMG,
    },
    image,
    imageUrl: image,
    priceLabel:
      typeof service.price === "number"
        ? `₹${service.price.toLocaleString("en-IN")}`
        : "Contact for Quote",
  };
}

export async function fetchServiceCategories(options = {}) {
  const result = await apiRequest("/meta/categories", {
    signal: options.signal,
  });
  return result.data;
}

export async function fetchServices(filters = {}) {
  const items = [];
  let cursor;
  do {
    const query = new URLSearchParams({ limit: "50" });
    for (const key of [
      "q",
      "category",
      "skills",
      "minPrice",
      "maxPrice",
      "sort",
    ]) {
      if (filters[key] !== undefined && filters[key] !== "") {
        query.set(key, String(filters[key]));
      }
    }
    if (cursor) query.set("cursor", cursor);
    const result = await apiRequest(`/services?${query}`, {
      signal: filters.signal,
    });
    items.push(...result.data.map(toServiceView));
    cursor = result.meta?.nextCursor || null;
  } while (cursor);
  return items;
}

export async function fetchServiceDB(id) {
  const result = await apiRequest(`/services/${encodeURIComponent(id)}`);
  return toServiceView(result.data);
}

export async function saveServiceDB(service) {
  const result = await apiRequest(
    "/services",
    { method: "POST", body: JSON.stringify(service) },
    true,
  );
  return result.data.id;
}

export async function updateServiceDB(id, service) {
  await apiRequest(
    `/services/${encodeURIComponent(id)}`,
    { method: "PUT", body: JSON.stringify(service) },
    true,
  );
  return true;
}

export async function deleteServiceDB(id) {
  await apiRequest(
    `/services/${encodeURIComponent(id)}`,
    { method: "DELETE" },
    true,
  );
  return true;
}
