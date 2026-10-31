import { createHash, randomUUID } from "node:crypto";
import { FieldPath, FieldValue } from "firebase-admin/firestore";
import { firestore } from "../../config/firebase.js";
import { paginateQuery } from "../../utils/pagination.js";

const tickets = () => firestore.collection("supportTickets");
const ticketRef = (id) => tickets().doc(id);

function stableTicketId(principal, idempotencyKey) {
  return `ticket_${createHash("sha256")
    .update(`${principal}\n${idempotencyKey}`)
    .digest("hex")}`;
}

export async function createSupportTicket(input, { userId, principal, idempotencyKey }) {
  const id = idempotencyKey
    ? stableTicketId(principal, idempotencyKey)
    : `ticket_${randomUUID()}`;
  const ref = ticketRef(id);

  await firestore.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (snapshot.exists) return;
    transaction.create(ref, {
      userId: userId ?? null,
      name: input.name,
      email: input.email,
      subject: input.subject,
      message: input.message,
      status: "open",
      ...(idempotencyKey
        ? {
            idempotencyKeyHash: createHash("sha256")
              .update(idempotencyKey)
              .digest("hex"),
          }
        : {}),
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  });

  const snapshot = await ref.get();
  return { id: snapshot.id, ...snapshot.data() };
}

async function listTickets(query, { limit, cursor }) {
  const page = await paginateQuery(query, {
    limit,
    cursor,
    orderByFields: ["createdAt", "__name__"],
  });
  return {
    items: page.docs.map((document) => ({
      id: document.id,
      ...document.data(),
    })),
    nextCursor: page.nextCursor,
  };
}

export function listTicketsForUser(userId, pagination) {
  return listTickets(
    tickets()
      .where("userId", "==", userId)
      .orderBy("createdAt", "desc")
      .orderBy(FieldPath.documentId(), "desc"),
    pagination,
  );
}

export function listAllTickets(pagination) {
  return listTickets(
    tickets()
      .orderBy("createdAt", "desc")
      .orderBy(FieldPath.documentId(), "desc"),
    pagination,
  );
}

const transitions = {
  open: new Set(["in_progress", "resolved"]),
  in_progress: new Set(["open", "resolved"]),
  resolved: new Set(),
};

export async function updateSupportTicketStatus(id, status) {
  const ref = ticketRef(id);
  const result = await firestore.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists) return { reason: "not_found" };
    const current = snapshot.get("status");
    if (current === status) return { reason: "unchanged" };
    if (!transitions[current]?.has(status)) return { reason: "invalid_transition" };
    transaction.update(ref, {
      status,
      updatedAt: FieldValue.serverTimestamp(),
    });
    return { reason: "updated" };
  });
  if (result.reason === "not_found") return null;
  if (result.reason === "invalid_transition") return result;
  const snapshot = await ref.get();
  return { reason: result.reason, ticket: { id: snapshot.id, ...snapshot.data() } };
}
