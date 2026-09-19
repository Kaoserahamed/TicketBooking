// ---------------------------------------------------------------------------
// Tickets service frontend (docs/04-api-design.md §4.7).
//
// NOTE — assumed contract: the backend ticket routes do not exist yet. The
// shapes follow the documented endpoints and the seeded `tickets` table
// (infrastructure/database/schema.sql + tests/sql/01-seed-data.sql:
// ticket_number 'TKT-00000001', qr_code 'qr://ticket/{id}', status ISSUED /
// USED, issued_at / used_at) so the backend can be dropped in without
// frontend changes:
//
// - GET /tickets/{id}      → 200 { status:'ok', ticket }
//     (owner or staff only — same authenticate middleware as /bookings/{id})
// - GET /tickets/{id}/qr   → binary image (image/png) — rendered in an <img>.
//     Auth must come from the access token; axios downloads it as a blob so
//     the Authorization header is attached (an <img src> cannot send headers).
// ---------------------------------------------------------------------------

import api from './client'

export type TicketStatus = 'ISSUED' | 'USED' | 'CANCELLED'

export interface Ticket {
  id: number
  bookingId: number
  ticketNumber: string
  qrCode: string
  status: TicketStatus
  issuedAt: string
  usedAt: string | null
}

export interface TicketEnvelope {
  status: 'ok'
  ticket: Ticket
}

export const ticketApi = {
  getTicket: async (id: number): Promise<Ticket> => {
    const { data } = await api.get<TicketEnvelope>(`/tickets/${id}`)
    return data.ticket
  },

  /** Download the QR image as an object URL (sends the Bearer token). */
  getTicketQrUrl: async (id: number): Promise<string> => {
    const response = await api.get(`/tickets/${id}/qr`, { responseType: 'blob' })
    return URL.createObjectURL(response.data as Blob)
  },
}
