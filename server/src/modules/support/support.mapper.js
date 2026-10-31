function toIsoString(value) {
  if (value && typeof value.toDate === "function") {
    return value.toDate().toISOString();
  }
  if (value instanceof Date) return value.toISOString();
  return null;
}

export function toSupportTicketDto(ticket) {
  return {
    id: ticket.id,
    userId: ticket.userId ?? null,
    name: ticket.name,
    email: ticket.email,
    subject: ticket.subject,
    message: ticket.message,
    status: ticket.status,
    createdAt: toIsoString(ticket.createdAt),
    updatedAt: toIsoString(ticket.updatedAt),
  };
}

export function toSupportTicketReceiptDto(ticket) {
  return {
    id: ticket.id,
    status: ticket.status,
    createdAt: toIsoString(ticket.createdAt),
  };
}
