import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from "../../utils/AppError.js";
import {
  createSupportTicket,
  listAllTickets,
  listTicketsForUser,
  updateSupportTicketStatus,
} from "./support.repository.js";

export async function submitSupportTicket(actor, input, requestIp, idempotencyKey) {
  if (input.companyWebsite) {
    throw new ValidationError([], "Support request could not be accepted");
  }
  if (idempotencyKey !== undefined && (idempotencyKey.length < 1 || idempotencyKey.length > 200)) {
    throw new ValidationError([], "Idempotency-Key must be between 1 and 200 characters");
  }
  const userId = actor?.uid ?? null;
  const principal = userId ? `user:${userId}` : `ip:${requestIp}`;
  const ticket = await createSupportTicket(input, {
    userId,
    principal,
    idempotencyKey,
  });
  return ticket;
}

export async function getMySupportTickets(actor, pagination) {
  const page = await listTicketsForUser(actor.uid, pagination);
  return {
    ...page,
    items: page.items,
  };
}

export async function getSupportTickets(pagination) {
  return listAllTickets(pagination);
}

export async function setSupportTicketStatus(id, status) {
  const result = await updateSupportTicketStatus(id, status);
  if (!result) throw new NotFoundError("Support ticket not found");
  if (result.reason === "invalid_transition") {
    throw new ConflictError("Support ticket status transition is not allowed");
  }
  return result.ticket;
}
