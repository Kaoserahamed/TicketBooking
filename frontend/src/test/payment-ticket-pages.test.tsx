import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import App from '../App'
import { bookingApi } from '../api/bookings'
import { paymentApi } from '../api/payments'
import { ticketApi } from '../api/tickets'
import { useAuthStore } from '../stores/auth'

vi.mock('../api/bookings', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/bookings')>()
  return {
    ...actual,
    bookingApi: {
      holdSeats: vi.fn(),
      getBooking: vi.fn(),
      cancelBooking: vi.fn(),
      listMyBookings: vi.fn(),
    },
  }
})

vi.mock('../api/payments', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/payments')>()
  return {
    ...actual,
    paymentApi: { createPayment: vi.fn(), getPayment: vi.fn() },
  }
})

vi.mock('../api/tickets', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/tickets')>()
  return {
    ...actual,
    ticketApi: { getTicket: vi.fn(), getTicketQrUrl: vi.fn() },
  }
})

const mockedBookingApi = vi.mocked(bookingApi, true)
const mockedPaymentApi = vi.mocked(paymentApi, true)
const mockedTicketApi = vi.mocked(ticketApi, true)

const booking = {
  id: 5,
  userId: 7,
  showId: 11,
  bookingReference: 'BK-ABC123',
  idempotencyKey: 'key-1',
  status: 'PENDING' as const,
  subtotal: 200,
  discount: 0,
  totalAmount: 200,
  currency: 'USD',
  expiresAt: '2026-02-01T18:10:00.000Z',
  createdAt: '2026-02-01T18:00:00.000Z',
  updatedAt: '2026-02-01T18:00:00.000Z',
  show: {
    id: 11,
    eventId: 3,
    venueId: 2,
    startTime: '2026-02-01T18:00:00.000Z',
    endTime: '2026-02-01T20:00:00.000Z',
    status: 'SCHEDULED',
    event: { id: 3, name: 'Rock Night', status: 'PUBLISHED' },
    venue: { id: 2, name: 'Grand Hall', address: '1 Main St', city: 'Dhaka', capacity: 500 },
  },
  user: { id: 7, name: 'Asha Example', email: 'asha@example.com' },
  items: [
    {
      id: 1,
      bookingId: 5,
      showSeatId: 101,
      seat: { id: 1, row: 'A', number: '1', label: 'A1', seatType: 'REGULAR' },
      price: 100,
    },
  ],
}

const pendingPayment = {
  id: 9,
  bookingId: 5,
  provider: 'NAGAD' as const,
  amount: 200,
  currency: 'USD',
  status: 'PENDING' as const,
  trxId: null,
  ticketId: null,
  createdAt: '2026-02-01T18:01:00.000Z',
  updatedAt: '2026-02-01T18:01:00.000Z',
}

const completedPayment = {
  ...pendingPayment,
  status: 'COMPLETED' as const,
  trxId: 'TRX-77',
  ticketId: 3,
}

const ticket = {
  id: 3,
  bookingId: 5,
  ticketNumber: 'TKT-00000003',
  qrCode: 'qr://ticket/3',
  status: 'ISSUED' as const,
  issuedAt: '2026-02-01T18:05:00.000Z',
  usedAt: null,
}

function signIn() {
  useAuthStore.setState({
    token: 'access-123',
    refreshToken: 'refresh-123',
    user: null,
    error: null,
  })
}

function renderAt(route: string) {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <App />
    </MemoryRouter>
  )
}

describe('payment page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    useAuthStore.setState({
      user: null,
      token: null,
      refreshToken: null,
      isLoading: false,
      error: null,
    })
    signIn()
  })

  it('pays with the selected provider, then polls status to completion', async () => {
    const user = userEvent.setup()
    mockedBookingApi.getBooking.mockResolvedValueOnce({
      status: 'ok',
      booking,
      items: booking.items,
    })
    mockedPaymentApi.createPayment.mockResolvedValueOnce(pendingPayment)
    mockedPaymentApi.getPayment.mockResolvedValueOnce(completedPayment)

    renderAt('/bookings/5/pay')

    // Booking summary renders from GET /bookings/5.
    expect(await screen.findByText('BK-ABC123')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Pay USD 200.00/ })).toBeInTheDocument()

    await user.click(screen.getByLabelText('Pay with Nagad'))
    await user.click(screen.getByRole('button', { name: /Pay USD 200.00/ }))

    expect(mockedPaymentApi.createPayment).toHaveBeenCalledWith(
      { bookingId: 5, provider: 'NAGAD' },
      expect.any(String)
    )
    expect(await screen.findByText(/Payment initiated via Nagad/)).toBeInTheDocument()

    // Manual status check (the 3s poll hits the same endpoint).
    await user.click(screen.getByRole('button', { name: 'Check status now' }))
    expect(mockedPaymentApi.getPayment).toHaveBeenCalledWith(9)

    expect(
      await screen.findByText('Payment completed! Your booking is confirmed.')
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /View your ticket/ })).toHaveAttribute(
      'href',
      '/tickets/3'
    )
  })

  it('rejects an invalid wallet number without calling the API', async () => {
    const user = userEvent.setup()
    mockedBookingApi.getBooking.mockResolvedValueOnce({
      status: 'ok',
      booking,
      items: booking.items,
    })

    renderAt('/bookings/5/pay')
    await screen.findByText('BK-ABC123')

    await user.type(screen.getByLabelText('Wallet number'), 'abc')
    await user.click(screen.getByRole('button', { name: /Pay USD 200.00/ }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/valid wallet number/)
    expect(mockedPaymentApi.createPayment).not.toHaveBeenCalled()
  })
})

describe('ticket detail page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    signIn()
    if (typeof URL.createObjectURL === 'undefined') {
      Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:qr-1'), revokeObjectURL: vi.fn() })
    }
  })

  it('shows ticket details with the QR image and booking link', async () => {
    mockedTicketApi.getTicket.mockResolvedValueOnce(ticket)
    mockedTicketApi.getTicketQrUrl.mockResolvedValueOnce('blob:qr-1')

    renderAt('/tickets/3')

    expect(await screen.findByText('TKT-00000003')).toBeInTheDocument()
    expect(screen.getByText('ISSUED')).toBeInTheDocument()
    expect(screen.getByAltText('QR code for ticket TKT-00000003')).toHaveAttribute(
      'src',
      'blob:qr-1'
    )
    expect(screen.getByRole('link', { name: /View booking #5/ })).toHaveAttribute(
      'href',
      '/bookings/5'
    )
  })

  it('shows a backend error in the alert region', async () => {
    mockedTicketApi.getTicket.mockRejectedValueOnce({
      response: { data: { message: 'Ticket not found' } },
    })

    renderAt('/tickets/3')

    expect(await screen.findByRole('alert')).toHaveTextContent('Ticket not found')
  })
})

describe('booking detail page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    signIn()
  })

  it('links a pending booking to the payment page', async () => {
    mockedBookingApi.getBooking.mockResolvedValueOnce({
      status: 'ok',
      booking,
      items: booking.items,
    })

    renderAt('/bookings/5')

    expect(await screen.findByRole('heading', { name: /BK-ABC123/ })).toBeInTheDocument()
    expect(screen.getByText(/A1/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Pay now' })).toHaveAttribute('href', '/bookings/5/pay')
  })

  it('links a confirmed booking with a ticket to the ticket page', async () => {
    mockedBookingApi.getBooking.mockResolvedValueOnce({
      status: 'ok',
      booking: { ...booking, status: 'CONFIRMED' as const, ticketId: 3 },
      items: booking.items,
    })

    renderAt('/bookings/5')

    const ticketLink = await screen.findByRole('link', { name: /View ticket/ })
    expect(ticketLink).toHaveAttribute('href', '/tickets/3')
    expect(screen.queryByRole('link', { name: 'Pay now' })).not.toBeInTheDocument()
  })
})
