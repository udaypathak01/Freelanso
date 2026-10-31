import { ValidationError } from "./AppError.js";
import { Timestamp } from "firebase-admin/firestore";

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 50;

export function parseLimit(value) {
  if (value === undefined) return DEFAULT_PAGE_SIZE;
  if (typeof value === "number") {
    if (Number.isInteger(value) && value >= 1 && value <= MAX_PAGE_SIZE) {
      return value;
    }
    throw new ValidationError([
      {
        path: ["query", "limit"],
        message: `limit must be an integer from 1 to ${MAX_PAGE_SIZE}`,
      },
    ]);
  }
  if (typeof value !== "string" || !/^\d+$/.test(value)) {
    throw new ValidationError([
      {
        path: ["query", "limit"],
        message: `limit must be an integer from 1 to ${MAX_PAGE_SIZE}`,
      },
    ]);
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > MAX_PAGE_SIZE) {
    throw new ValidationError([
      {
        path: ["query", "limit"],
        message: `limit must be an integer from 1 to ${MAX_PAGE_SIZE}`,
      },
    ]);
  }
  return parsed;
}

export function encodeCursor(values) {
  const serializable = values.map((value) =>
    value instanceof Timestamp
      ? { __cursorTimestamp: [value.seconds, value.nanoseconds] }
      : value,
  );
  return Buffer.from(JSON.stringify(serializable)).toString("base64url");
}

export function decodeCursor(cursor) {
  if (cursor === undefined) return undefined;
  if (typeof cursor !== "string" || cursor.length > 2048) {
    throw new ValidationError([
      { path: ["query", "cursor"], message: "cursor is invalid" },
    ]);
  }
  try {
    const values = JSON.parse(
      Buffer.from(cursor, "base64url").toString("utf8"),
      (key, value) => {
        if (
          value &&
          typeof value === "object" &&
          Array.isArray(value.__cursorTimestamp)
        ) {
          return new Timestamp(
            value.__cursorTimestamp[0],
            value.__cursorTimestamp[1],
          );
        }
        return value;
      },
    );
    if (!Array.isArray(values) || values.length === 0)
      throw new Error("Invalid cursor values");
    return values;
  } catch {
    throw new ValidationError([
      { path: ["query", "cursor"], message: "cursor is invalid" },
    ]);
  }
}

export async function paginateQuery(
  query,
  { limit = DEFAULT_PAGE_SIZE, cursor, orderByFields = [] } = {},
) {
  const pageSize = parseLimit(limit);
  const cursorValues = decodeCursor(cursor);
  if (orderByFields.length === 0) {
    throw new Error(
      "paginateQuery requires the fields used by the query orderBy clauses",
    );
  }
  if (cursorValues && cursorValues.length !== orderByFields.length) {
    throw new ValidationError([
      {
        path: ["query", "cursor"],
        message: "cursor is invalid for this query",
      },
    ]);
  }

  let pageQuery = cursorValues ? query.startAfter(...cursorValues) : query;
  pageQuery = pageQuery.limit(pageSize + 1);

  const snapshot = await pageQuery.get();
  const hasMore = snapshot.docs.length > pageSize;
  const docs = snapshot.docs.slice(0, pageSize);
  const nextCursor = hasMore
    ? encodeCursor(
        orderByFields.map((field) =>
          field === "__name__" ? docs.at(-1).id : docs.at(-1).get(field),
        ),
      )
    : null;

  return { docs, nextCursor };
}

export async function paginateFilteredQuery(
  query,
  {
    limit = DEFAULT_PAGE_SIZE,
    cursor,
    orderByFields = [],
    matches,
    maxScanned = 500,
  } = {},
) {
  const pageSize = parseLimit(limit);
  const cursorValues = decodeCursor(cursor);
  if (orderByFields.length === 0 || typeof matches !== "function") {
    throw new Error(
      "paginateFilteredQuery requires ordered fields and a match predicate",
    );
  }
  if (cursorValues && cursorValues.length !== orderByFields.length) {
    throw new ValidationError([
      {
        path: ["query", "cursor"],
        message: "cursor is invalid for this query",
      },
    ]);
  }

  const matchingDocs = [];
  let lastScanned;
  let scanned = 0;
  let exhausted = false;
  while (matchingDocs.length <= pageSize && scanned < maxScanned) {
    const batchSize = Math.min(100, maxScanned - scanned);
    let pageQuery = query;
    const after = lastScanned
      ? orderByFields.map((field) =>
          field === "__name__" ? lastScanned.id : lastScanned.get(field),
        )
      : cursorValues;
    if (after) pageQuery = pageQuery.startAfter(...after);
    const snapshot = await pageQuery.limit(batchSize).get();
    if (snapshot.empty) {
      exhausted = true;
      break;
    }
    for (const doc of snapshot.docs) {
      lastScanned = doc;
      scanned += 1;
      if (matches(doc)) matchingDocs.push(doc);
      if (matchingDocs.length > pageSize) break;
    }
    if (matchingDocs.length > pageSize) break;
    if (snapshot.size < batchSize) {
      exhausted = true;
      break;
    }
  }

  const hasMoreMatches = matchingDocs.length > pageSize;
  const docs = matchingDocs.slice(0, pageSize);
  const cursorDoc = hasMoreMatches ? docs.at(-1) : lastScanned;
  const nextCursor =
    cursorDoc && (hasMoreMatches || !exhausted)
      ? encodeCursor(
          orderByFields.map((field) =>
            field === "__name__" ? cursorDoc.id : cursorDoc.get(field),
          ),
        )
      : null;
  return { docs, nextCursor };
}
