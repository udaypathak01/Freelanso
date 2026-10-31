import { auth as firebaseAuth } from "./firebase";
import { apiRequest } from "./api";

export const PLACEHOLDER_IMG =
  "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=1000&auto=format&fit=crop";

export const getMediaPreview = (item) => {
  if (!item) return PLACEHOLDER_IMG;

  const rawUrl = item.thumbnailUrl || item.imageUrl || item.img || item.url || "";
  if (
    rawUrl &&
    !rawUrl.toLowerCase().includes(".mp4") &&
    !rawUrl.toLowerCase().includes(".mov")
  ) {
    return rawUrl;
  }

  if (rawUrl.includes("res.cloudinary.com")) {
    return rawUrl.replace("/video/upload/", "/video/upload/f_jpg,so_0/");
  }

  return PLACEHOLDER_IMG;
};

export const marketplaceApi = apiRequest;

async function fetchProjectPages(path, authenticated = false, filters = {}) {
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
    const result = await apiRequest(
      `${path}?${query}`,
      { signal: filters.signal },
      authenticated,
    );
    items.push(...result.data);
    cursor = result.meta?.nextCursor || null;
  } while (cursor);
  return items;
}

export const fetchProjects = (filters = {}) =>
  fetchProjectPages("/projects", false, filters);

export async function fetchProjectsPage(filters = {}) {
  const query = new URLSearchParams({
    limit: String(filters.limit ?? 50),
  });
  for (const key of ["q", "category", "skills", "minPrice", "maxPrice", "sort", "cursor"]) {
    if (filters[key] !== undefined && filters[key] !== "") {
      query.set(key, String(filters[key]));
    }
  }
  const result = await apiRequest(
    `/projects?${query}`,
    { signal: filters.signal },
    false,
  );
  return {
    items: result.data,
    nextCursor: result.meta?.nextCursor || null,
    total: result.meta?.total,
  };
}

export async function fetchDashboard(filters = {}) {
  const query = new URLSearchParams();
  for (const key of ["limit", "projectCursor", "serviceCursor"]) {
    if (filters[key] !== undefined && filters[key] !== "") {
      query.set(key, String(filters[key]));
    }
  }
  const result = await apiRequest(
    `/dashboard${query.size ? `?${query.toString()}` : ""}`,
    { signal: filters.signal },
    true,
  );
  return result.data;
}

export async function fetchCurrentProfile() {
  const result = await apiRequest("/users/me", {}, true);
  return result.data;
}

export async function createJob(job) {
  const result = await apiRequest(
    "/jobs",
    { method: "POST", body: JSON.stringify(job) },
    true,
  );
  return result.data;
}

export async function updateJob(id, job) {
  const result = await apiRequest(
    `/jobs/${encodeURIComponent(id)}`,
    { method: "PUT", body: JSON.stringify(job) },
    true,
  );
  return result.data;
}

export async function fetchMyJobs(options = {}) {
  const query = new URLSearchParams({ limit: String(options.limit ?? 20) });
  if (options.cursor) query.set("cursor", options.cursor);
  const result = await apiRequest(`/jobs/mine?${query}`, {}, true);
  return { items: result.data, nextCursor: result.meta?.nextCursor ?? null };
}

export async function fetchMyApplications(options = {}) {
  const query = new URLSearchParams({ limit: String(options.limit ?? 20) });
  if (options.cursor) query.set("cursor", options.cursor);
  const result = await apiRequest(`/applications/me?${query}`, {}, true);
  return { items: result.data, nextCursor: result.meta?.nextCursor ?? null };
}

export async function fetchJobApplications(jobId, options = {}) {
  const query = new URLSearchParams({ limit: String(options.limit ?? 20) });
  if (options.cursor) query.set("cursor", options.cursor);
  const result = await apiRequest(
    `/jobs/${encodeURIComponent(jobId)}/applications?${query}`,
    {},
    true,
  );
  return { items: result.data, nextCursor: result.meta?.nextCursor ?? null };
}

export async function updateApplicationStatus(applicationId, status) {
  const result = await apiRequest(
    `/applications/${encodeURIComponent(applicationId)}/status`,
    { method: "PATCH", body: JSON.stringify({ status }) },
    true,
  );
  return result.data;
}

export async function fetchServicesPage(filters = {}) {
  const query = new URLSearchParams({
    limit: String(filters.limit ?? 6),
    sort: filters.sort ?? "newest",
  });
  if (filters.cursor) query.set("cursor", filters.cursor);
  const result = await apiRequest(`/services?${query}`, {
    signal: filters.signal,
  });
  return { items: result.data, nextCursor: result.meta?.nextCursor ?? null };
}

export const fetchMyProjectsDB = () =>
  fetchProjectPages("/projects/mine", true);

export async function fetchProjectDB(id) {
  const result = await apiRequest(
    `/projects/${encodeURIComponent(id)}`,
    {},
    Boolean(firebaseAuth.currentUser),
  );
  return result.data;
}

function needsLegacyConversationPayload(error) {
  if (error?.code !== "VALIDATION_ERROR" || !Array.isArray(error.details)) {
    return false;
  }

  const expectsLegacyRecipient = error.details.some(
    (issue) =>
      issue.code === "invalid_type" &&
      Array.isArray(issue.path) &&
      issue.path.join(".") === "body.recipientUid",
  );
  const rejectsNewPayload = error.details.some(
    (issue) =>
      issue.code === "unrecognized_keys" &&
      Array.isArray(issue.path) &&
      issue.path.join(".") === "body" &&
      typeof issue.message === "string" &&
      issue.message.includes("recipientId"),
  );

  return expectsLegacyRecipient && rejectsNewPayload;
}

export async function createConversation(recipientId, postId) {
  try {
    const result = await apiRequest(
      "/conversations",
      {
        method: "POST",
        body: JSON.stringify({ recipientUid: recipientId }),
      },
      true,
    );
    if (typeof result?.data?.id !== "string" || !result.data.id) {
      throw new Error("The API did not return a conversation ID");
    }
    return result.data;
  } catch (error) {
    if (needsLegacyConversationPayload(error)) {
      const result = await apiRequest(
        "/conversations",
        {
          method: "POST",
          body: JSON.stringify({
            recipientId,
            ...(postId ? { postId } : {}),
          }),
        },
        true,
      );
      if (typeof result?.data?.id !== "string" || !result.data.id) {
        throw new Error("The API did not return a conversation ID");
      }
      return result.data;
    }
    throw error;
  }
}

export async function fetchConversations() {
  const result = await apiRequest("/conversations", {}, true);
  return result.data;
}

export async function fetchConversationMessages(conversationId, options = {}) {
  const query = new URLSearchParams({ limit: String(options.limit ?? 30) });
  if (options.before) query.set("before", options.before);
  const result = await apiRequest(
    `/conversations/${encodeURIComponent(conversationId)}/messages?${query}`,
    {},
    true,
  );
  return {
    items: result.data,
    nextCursor: result.meta?.nextCursor ?? null,
    hasMore: result.meta?.hasMore === true,
  };
}

export async function sendConversationMessage(conversationId, text, tempId) {
  const result = await apiRequest(
    `/conversations/${encodeURIComponent(conversationId)}/messages`,
    {
      method: "POST",
      body: JSON.stringify({ text, tempId }),
    },
    true,
  );
  return result.data;
}

export async function markConversationRead(conversationId) {
  const result = await apiRequest(
    `/conversations/${encodeURIComponent(conversationId)}/read`,
    { method: "POST", body: JSON.stringify({}) },
    true,
  );
  return result.data;
}

export async function markNotificationRead(notificationId) {
  const result = await apiRequest(
    `/notifications/${encodeURIComponent(notificationId)}/read`,
    { method: "POST", body: JSON.stringify({}) },
    true,
  );
  return result.data;
}

export async function markAllNotificationsRead() {
  const result = await apiRequest(
    "/notifications/read-all",
    { method: "POST", body: JSON.stringify({}) },
    true,
  );
  return result.data;
}

export async function fetchUnreadMessageCount() {
  const result = await apiRequest("/conversations/unread-count", {}, true);
  return result.data.total;
}

export async function submitSupportTicket(ticket, idempotencyKey) {
  const result = await apiRequest(
    "/support/tickets",
    {
      method: "POST",
      headers: { "Idempotency-Key": idempotencyKey },
      body: JSON.stringify(ticket),
    },
    Boolean(firebaseAuth.currentUser),
  );
  return result.data;
}

export async function saveProjectDB(project) {
  const result = await apiRequest(
    "/projects",
    { method: "POST", body: JSON.stringify(project) },
    true,
  );
  return result.data.id;
}

export async function updateProjectDB(id, project) {
  await apiRequest(
    `/projects/${encodeURIComponent(id)}`,
    { method: "PUT", body: JSON.stringify(project) },
    true,
  );
  return true;
}

export async function deleteProjectDB(id) {
  await apiRequest(
    `/projects/${encodeURIComponent(id)}`,
    { method: "DELETE" },
    true,
  );
  return true;
}

export async function fetchSmartSearch(query, filters = {}) {
  const { signal, ...searchFilters } = filters;
  const result = await apiRequest(
    "/search/smart",
    {
      method: "POST",
      body: JSON.stringify({ query, filters: searchFilters }),
      signal,
    },
    true,
  );
  if (!Array.isArray(result.data)) {
    throw new Error("The server returned an invalid search response");
  }
  return { items: result.data, meta: result.meta || {} };
}

export async function toggleLikeDB(id) {
  const result = await apiRequest(
    `/projects/${encodeURIComponent(id)}/like`,
    { method: "POST", body: JSON.stringify({}) },
    true,
  );
  return result.data;
}

export async function fetchCommentsDB(projectId) {
  const result = await apiRequest(
    `/projects/${encodeURIComponent(projectId)}/comments?limit=50`,
  );
  return result.data;
}

export async function postCommentDB(projectId, text) {
  const result = await apiRequest(
    `/projects/${encodeURIComponent(projectId)}/comments`,
    { method: "POST", body: JSON.stringify({ text }) },
    true,
  );
  return result.data;
}

export async function deleteCommentDB(projectId, commentId) {
  await apiRequest(
    `/projects/${encodeURIComponent(projectId)}/comments/${encodeURIComponent(commentId)}`,
    { method: "DELETE", body: JSON.stringify({}) },
    true,
  );
}
