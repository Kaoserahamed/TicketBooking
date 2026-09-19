import { describe, expect, it, vi, beforeEach } from 'vitest'
import api from '../api/client'
import { paymentApi } from '../api/payments'
import { ticketApi } from '../api/tickets'

vi.mock('../api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/client')>()
  const post = vi.fn()
  const get = vi.fn()
  const put = vi.fn()
  return { ...actual, default: { post, get, put } }
})

const mockedApi = vi.mocked(api, true)

// STEP 7 — payment + tickets service frontend (docs/04-api-design.md §4.6/§4.7).
// Assumed backend contract (routes not implemented yet): /payments/create +
// /payments/{id} with { status:'ok', payment }, /tickets/{id} with
// { status:'ok', ticket } and /tickets/{id}/qr as a binary blob.
describe('payment service frontend', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('creates a payment with provider + Idempotency-Key header and unwraps { payment }', async () => {
    mockedApi.post.mockResolvedValueOnce({
      data: {
        status: 'ok',
        payment: {
          id: 9, bookingId: 5, provider: 'BKASH', amount: 200, currency: 'USD',
          status: 'PENDING', trxId: null, ticketId: null,
          createdAt: '2026-02-01T18:01:00.000Z', updatedAt: '2026-02-01T18:01:00.000Z',
        },
      },
    })

    const payment = await paymentApi.createPayment({ bookingId: 5, provider: 'BKASH' }, 'idem-1')

    expect(mockedApi.post).toHaveBeenCalledWith(
      '/payments/create',
      { bookingId: 5, provider: 'BKASH' },
      { headers: { 'Idempotency-Key': 'idem-1' } },
    )
    expect(payment.status).toBe('PENDING')
    expect(payment.provider).toBe('BKASH')
  })

  it('sends the payer phone when provided', async () => {
    mockedApi.post.mockResolvedValueOnce({
      data: {
        status: 'ok',
        payment: {
          id: 10, bookingId: 5, provider: 'NAGAD', amount: 200, currency: 'USD',
          status: 'INITIATED', trxId: null, ticketId: null,
          createdAt: '', updatedAt: '',
        },
      },
    })

    await paymentApi.createPayment({ bookingId: 5, provider: 'NAGAD', payerPhone: '01712345678' })

    expect(mockedApi.post).toHaveBeenCalledWith(
      '/payments/create',
      { bookingId: 5, provider: 'NAGAD', payerPhone: '01712345678' },
      undefined,
    )
  })

  it('gets payment status and unwraps { payment } with ticket id on completion', async () => {
    mockedApi.get.mockResolvedValueOnce({
      data: {
        status: 'ok',
        payment: {
          id: 9, bookingId: 5, provider: 'BKASH', amount: 200, currency: 'USD',
          status: 'COMPLETED', trxId: 'TRX-77', ticketId: 3,
          createdAt: '', updatedAt: '',
        },
      },
    })

    const payment = await paymentApi.getPayment(9)

    expect(mockedApi.get).toHaveBeenCalledWith('/payments/9')
    expect(payment.status).toBe('COMPLETED')
    expect(payment.trxId).toBe('TRX-77')
    expect(payment.ticketId).toBe(3)
  })
})

describe('tickets service frontend', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    if (typeof URL.createObjectURL === 'undefined') {
      Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:qr-1'), revokeObjectURL: vi.fn() })
    }
  })

  it('gets ticket details and unwraps { ticket }', async () => {
    mockedApi.get.mockResolvedValueOnce({
      data: {
        status: 'ok',
        ticket: {
          id: 3, bookingId: 5, ticketNumber: 'TKT-00000003', qrCode: 'qr://ticket/3',
          status: 'ISSUED', issuedAt: '2026-02-01T18:05:00.000Z', usedAt: null,
        },
      },
    })

    const ticket = await ticketApi.getTicket(3)

    expect(mockedApi.get).toHaveBeenCalledWith('/tickets/3')
    expect(ticket.ticketNumber).toBe('TKT-00000003')
    expect(ticket.status).toBe('ISSUED')
  })

  it('downloads the QR as a blob object URL with auth headers', async () => {
    const blob = new Blob(['png'])
    mockedApi.get.mockResolvedValueOnce({ data: blob })

    // happy-dom already provides URL.createObjectURL (returns blob:nodedata:…),
    // so stub it explicitly to a deterministic value.
    const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:qr-1')

    const url = await ticketApi.getTicketQrUrl(3)

    expect(mockedApi.get).toHaveBeenCalledWith('/tickets/3/qr', { responseType: 'blob' })
    expect(createObjectURL).toHaveBeenCalledWith(blob)
    expect(url).toBe('blob:qr-1')
    createObjectURL.mockRestore()
  })
})
