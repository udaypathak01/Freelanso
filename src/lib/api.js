import { auth as firebaseAuth } from "./firebase";

const configuredApiUrl = import.meta.env.VITE_API_URL?.replace(/\/+$/, "");
const API_BASE = configuredApiUrl
  ? configuredApiUrl.endsWith("/api")
    ? configuredApiUrl
    : `${configuredApiUrl}/api`
  : import.meta.env.DEV
    ? "http://localhost:5000/api"
    : "/api";

export class ApiError extends Error {
  constructor(message, { status = 0, code = "API_ERROR", details = null } = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export async function apiRequest(path, options = {}, authenticated = false) {
  const { authRequired = authenticated, ...requestOptions } = options;
  const user = firebaseAuth.currentUser;

  if (authRequired && !user) {
    throw new ApiError("Please log in to continue", {
      status: 401,
      code: "AUTH_REQUIRED",
    });
  }

  const url = `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`;
  const headers = new Headers(requestOptions.headers || {});
  const hasBody = requestOptions.body !== undefined && requestOptions.body !== null;
  if (
    hasBody &&
    !(requestOptions.body instanceof FormData) &&
    !headers.has("Content-Type")
  ) {
    headers.set("Content-Type", "application/json");
  }

  const makeRequest = async (token) => {
    const requestHeaders = new Headers(headers);
    if (token) requestHeaders.set("Authorization", `Bearer ${token}`);
    try {
      return await fetch(url, { ...requestOptions, headers: requestHeaders });
    } catch (error) {
      if (error?.name === "AbortError") throw error;
      const apiOrigin = new URL(API_BASE, window.location.origin).origin;
      throw new ApiError(
        `Cannot reach the API at ${apiOrigin}. Start the backend from the server folder with "npm run dev" and check its CORS settings.`,
        { code: "API_UNREACHABLE" },
      );
    }
  };

  let token = user ? await user.getIdToken() : null;
  let response = await makeRequest(token);
  if (response.status === 401 && user) {
    token = await user.getIdToken(true);
    response = await makeRequest(token);
  }

  if (response.status === 204) return null;

  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new ApiError(
      response.ok
        ? "The server returned an invalid response"
        : `Request failed (${response.status})`,
      { status: response.status, code: "INVALID_API_RESPONSE" },
    );
  }

  if (!response.ok || payload?.success !== true) {
    const validationDetails = Array.isArray(payload?.error?.details)
      ? payload.error.details
          .map((detail) => {
            const path = Array.isArray(detail?.path)
              ? detail.path.join(".")
              : "";
            return [path, detail?.message].filter(Boolean).join(": ");
          })
          .filter(Boolean)
          .join("; ")
      : "";
    const errorMessage = payload?.error?.message || `Request failed (${response.status})`;
    throw new ApiError(
      validationDetails ? `${errorMessage}: ${validationDetails}` : errorMessage,
      {
        status: response.status,
        code: payload?.error?.code || "API_ERROR",
        details: payload?.error?.details ?? null,
      },
    );
  }

  return payload;
}
