import api from './client'
import type { BookingStatus } from './bookings'

// ---------------------------------------------------------------------------
// Payment service frontend (docs/04-api-design.md §4.6).
//
// NOTE — assumed contract: the backend payment routes do not exist yet. The
// shapes below follow the documented endpoints and the codebase conventions
// (status envelopes, toBooking-style serializers) so the backend can be
// dropped in without frontend changes:
//
// - POST /payments/create  { bookingId, provider, payerPhone? }
//     → 201 { status:'ok', payment }
//   Providers are BKASH / NAGAD, configured on the backend via env vars
//   (bKash/Nagad merchant credentials). The SPA never sees those secrets —
//   it only selects the provider and polls for the result.
//   Per doc §4.1 the request carries an `Idempotency-Key` header.
// - GET /payments/{id}  → { status:'ok', payment }
//   When COMPLETED the payment also carries the issued ticket id.
// - POST /payments/webhook is provider→backend only (signature-verified,
//   no auth). The SPA never calls it.
// ---------------------------------------------------------------------------

export type PaymentProvider = 'BKASH' | 'NAGAD'

export type PaymentStatus =
  | 'INITIATED'
  | 'PENDING'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED'

/** Statuses that stop polling. */
export const TERMINAL_PAYMENT_STATUSES: PaymentStatus[] = ['COMPLETED', 'FAILED', 'CANCELLED']

export interface Payment {
  id: number
  bookingId: number
  provider: PaymentProvider
  amount: number
  currency: string
  status: PaymentStatus
  /** Provider transaction id once the gateway confirms. */
  trxId: string | null
  /** Set by the backend when the payment completes and the ticket is issued. */
  ticketId: number | null
  /** Booking status after this payment (CONFIRMED on success). */
  bookingStatus?: BookingStatus
  createdAt: string
  updatedAt: string
}

export interface CreatePaymentInput {
  bookingId: number
  provider: PaymentProvider
  /** Mobile-wallet account number for bKash/Nagad (optional, provider-dependent). */
  payerPhone?: string
}

export interface PaymentEnvelope {
  status: 'ok'
  payment: Payment
}

export const paymentApi = {
  createPayment: async (input: CreatePaymentInput, idempotencyKey?: string): Promise<Payment> => {
    const { data } = await api.post<PaymentEnvelope>(
      '/payments/create',
      input,
      idempotencyKey ? { headers: { 'Idempotency-Key': idempotencyKey } } : undefined,
    )
    return data.payment
  },

  getPayment: async (id: number): Promise<Payment> => {
    const { data } = await api.get<PaymentEnvelope>(`/payments/${id}`)
    return data.payment
  },
}
