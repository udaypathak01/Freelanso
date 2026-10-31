import { asyncHandler } from "../../utils/asyncHandler.js";
import { created, ok, paginated } from "../../utils/response.js";
import { DEFAULT_PAGE_SIZE } from "../../utils/pagination.js";
import {
  toSupportTicketDto,
  toSupportTicketReceiptDto,
} from "./support.mapper.js";
import {
  getMySupportTickets,
  getSupportTickets,
  setSupportTicketStatus,
  submitSupportTicket,
} from "./support.service.js";

export const postSupportTicket = asyncHandler(async (req, res) => {
  const ticket = await submitSupportTicket(
    req.user,
    req.validated.body,
    req.ip,
    req.get("Idempotency-Key"),
  );
  return created(res, toSupportTicketReceiptDto(ticket));
});

export const getMySupportTicketsHandler = asyncHandler(async (req, res) => {
  const page = await getMySupportTickets(req.user, req.validated.query);
  return paginated(
    res,
    page.items.map(toSupportTicketDto),
    page.nextCursor,
    { limit: req.validated.query.limit ?? DEFAULT_PAGE_SIZE },
  );
});

export const getSupportTicketsHandler = asyncHandler(async (req, res) => {
  const page = await getSupportTickets(req.validated.query);
  return paginated(
    res,
    page.items.map(toSupportTicketDto),
    page.nextCursor,
    { limit: req.validated.query.limit ?? DEFAULT_PAGE_SIZE },
  );
});

export const patchSupportTicketStatus = asyncHandler(async (req, res) =>
  ok(
    res,
    toSupportTicketDto(
      await setSupportTicketStatus(
        req.validated.params.id,
        req.validated.body.status,
      ),
    ),
  ),
);
