import { query } from '../db.ts';
import type { SupportTicket, SupportTicketReply, SupportTicketStatus } from '../../src/types/findkart.ts';

interface SupportTicketRow {
  ticket_id: string;
  user_id?: string;
  customer_name: string;
  email: string;
  order_id: string;
  category: string;
  subject: string;
  message: string;
  attachment_name?: string;
  attachment_type?: string;
  status: SupportTicketStatus;
  sla_due_at: Date | string;
  assigned_specialist: string;
  replies: SupportTicketReply[];
  created_at: Date | string;
}

function mapRowToTicket(row: SupportTicketRow): SupportTicket {
  return {
    ticketId: row.ticket_id,
    userId: row.user_id || undefined,
    customerName: row.customer_name,
    email: row.email,
    orderId: row.order_id,
    category: row.category as SupportTicket['category'],
    subject: row.subject,
    message: row.message,
    attachmentName: row.attachment_name || undefined,
    attachmentType: row.attachment_type || undefined,
    status: row.status,
    slaDueAt: row.sla_due_at instanceof Date ? row.sla_due_at.toISOString() : String(row.sla_due_at),
    assignedSpecialist: row.assigned_specialist,
    replies: Array.isArray(row.replies) ? row.replies : [],
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
  };
}

export async function listVisibleTickets(options: {
  claimsUserId?: string;
  guestTicketIds?: Set<string>;
  starterIds: Set<string>;
}): Promise<SupportTicket[]> {
  const starterArray = Array.from(options.starterIds);
  const guestArray = options.guestTicketIds ? Array.from(options.guestTicketIds) : [];

  const res = await query<SupportTicketRow>(
    `SELECT ticket_id, user_id, customer_name, email, order_id,
            category, subject, message, attachment_name, attachment_type,
            status, sla_due_at, assigned_specialist, replies, created_at
     FROM support_tickets
     WHERE ticket_id = ANY($1::varchar[])
        OR ($2::varchar IS NOT NULL AND user_id = $2)
        OR (user_id IS NULL AND ticket_id = ANY($3::varchar[]))
     ORDER BY created_at DESC
     LIMIT 100`,
    [starterArray, options.claimsUserId || null, guestArray]
  );

  return res.rows.map(mapRowToTicket);
}

export async function findTicketById(ticketId: string): Promise<SupportTicket | null> {
  const res = await query<SupportTicketRow>(
    `SELECT ticket_id, user_id, customer_name, email, order_id,
            category, subject, message, attachment_name, attachment_type,
            status, sla_due_at, assigned_specialist, replies, created_at
     FROM support_tickets
     WHERE ticket_id = $1
     LIMIT 1`,
    [ticketId]
  );

  if (res.rows.length === 0) return null;
  return mapRowToTicket(res.rows[0]);
}

export async function createTicket(ticket: SupportTicket): Promise<SupportTicket> {
  await query(
    `INSERT INTO support_tickets (
      ticket_id, user_id, customer_name, email, order_id,
      category, subject, message, attachment_name, attachment_type,
      status, sla_due_at, assigned_specialist, replies, created_at
    ) VALUES ($1, $2, $3, LOWER($4), $5, $6, $7, $8, $9, $10, $11, $12, $13, $14::jsonb, $15)`,
    [
      ticket.ticketId,
      ticket.userId || null,
      ticket.customerName,
      ticket.email,
      ticket.orderId,
      ticket.category,
      ticket.subject,
      ticket.message,
      ticket.attachmentName || null,
      ticket.attachmentType || null,
      ticket.status,
      ticket.slaDueAt,
      ticket.assignedSpecialist,
      JSON.stringify(ticket.replies || []),
      ticket.createdAt,
    ]
  );

  return ticket;
}

export async function addReply(
  ticketId: string,
  reply: SupportTicketReply
): Promise<SupportTicket | null> {
  const ticket = await findTicketById(ticketId);
  if (!ticket) return null;

  const updatedReplies = [...ticket.replies, reply];
  const newStatus: SupportTicketStatus =
    ticket.status === 'Resolved' ? 'Under Review' : ticket.status;

  await query(
    `UPDATE support_tickets
     SET replies = $1::jsonb, status = $2
     WHERE ticket_id = $3`,
    [JSON.stringify(updatedReplies), newStatus, ticketId]
  );

  ticket.replies = updatedReplies;
  ticket.status = newStatus;
  return ticket;
}

export async function updateTicketStatus(
  ticketId: string,
  status: SupportTicketStatus
): Promise<SupportTicket | null> {
  const res = await query<SupportTicketRow>(
    `UPDATE support_tickets
     SET status = $1
     WHERE ticket_id = $2
     RETURNING ticket_id, user_id, customer_name, email, order_id,
               category, subject, message, attachment_name, attachment_type,
               status, sla_due_at, assigned_specialist, replies, created_at`,
    [status, ticketId]
  );

  if (res.rows.length === 0) return null;
  return mapRowToTicket(res.rows[0]);
}
