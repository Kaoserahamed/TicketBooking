import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import App from '../App'
import { showApi } from '../api/shows'
import { bookingApi } from '../api/bookings'
import { useAuthStore } from '../stores/auth'

vi.mock('../api/shows', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/shows')>()
  return {
    ...actual,
    showApi: {
      listShows: vi.fn(),
      getShow: vi.fn(),
      getSeatMap: vi.fn(),
      getAvailability: vi.fn(),
    },
  }
})

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

const mockedShowApi = vi.mocked(showApi, true)
const mockedBookingApi = vi.mocked(bookingApi, true)

const show = {
  id: 11,
  eventId: 3,
  event: { id: 3, name: 'Rock Night', status: 'PUBLISHED' },
  venueId: 2,
  venue: { id: 2, name: 'Grand Hall', address: '1 Main St', city: 'Dhaka', capacity: 500 },
  startTime: '2026-02-01T18:00:00.000Z',
  endTime: '2026-02-01T20:00:00.000Z',
  status: 'SCHEDULED',
  createdAt: '2026-01-01T00:00:00.000Z',
  seats: { total: 2, available: 2, held: 0, booked: 0, blocked: 0 },
}

const seats = [
  {
    showSeatId: 101,
    showId: 11,
    seatId: 1,
    row: 'A',
    number: '1',
    label: 'A1',
    seatType: 'REGULAR',
    price: '100.00',
    status: 'AVAILABLE' as const,
    holdExpiresAt: null,
  },
  {
    showSeatId: 102,
    showId: 11,
    seatId: 2,
    row: 'A',
    number: '2',
    label: 'A2',
    seatType: 'REGULAR',
    price: '100.00',
    status: 'BOOKED' as const,
    holdExpiresAt: null,
  },
]

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

function signIn() {
  useAuthStore.setState({
    token: 'access-123',
    refreshToken: 'refresh-123',
    user: null,
    error: null,
  })
}

describe('booking pages', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    useAuthStore.setState({
      user: null,
      token: null,
      refreshToken: null,
      error: null,
      isLoading: false,
    })
  })

  it('holds seats from the book page with physical seat ids', async () => {
    const userAction = userEvent.setup()
    signIn()
    mockedShowApi.getShow.mockResolvedValueOnce(show)
    mockedShowApi.getSeatMap
      .mockResolvedValueOnce({ status: 'ok', showId: 11, total: 2, seats })
      .mockResolvedValueOnce({ status: 'ok', showId: 11, total: 2, seats })
    mockedBookingApi.holdSeats.mockImplementationOnce(async (input) => {
      expect(input.showId).toBe(11)
      expect(input.seatIds).toEqual([1])
      expect(typeof input.idempotencyKey).toBe('string')
      return { status: 'ok', booking, items: booking.items, idempotentReplay: false }
    })

    render(
      <MemoryRouter initialEntries={['/book/11']}>
        <App />
      </MemoryRouter>
    )

    await userAction.click(await screen.findByRole('button', { name: /Seat A1/ }))
    await userAction.click(screen.getByRole('button', { name: /Hold 1 seat/ }))

    expect(await screen.findByText(/Seats held!/)).toBeInTheDocument()
    expect(screen.getByText(/Reference BK-ABC123/)).toBeInTheDocument()
  })

  it('shows seat-unavailable backend errors on the book page', async () => {
    const userAction = userEvent.setup()
    signIn()
    mockedShowApi.getShow.mockResolvedValueOnce(show)
    mockedShowApi.getSeatMap.mockResolvedValueOnce({ status: 'ok', showId: 11, total: 2, seats })
    mockedBookingApi.holdSeats.mockRejectedValueOnce({
      response: { data: { message: 'One or more seats are no longer available' } },
    })

    render(
      <MemoryRouter initialEntries={['/book/11']}>
        <App />
      </MemoryRouter>
    )

    await userAction.click(await screen.findByRole('button', { name: /Seat A1/ }))
    await userAction.click(screen.getByRole('button', { name: /Hold 1 seat/ }))

    expect(await screen.findByRole('alert')).toHaveTextContent('no longer available')
  })

  it('lists my bookings and cancels a pending one', async () => {
    const userAction = userEvent.setup()
    signIn()
    mockedBookingApi.listMyBookings.mockResolvedValue({
      status: 'ok',
      total: 1,
      bookings: [booking],
    })
    mockedBookingApi.cancelBooking.mockResolvedValueOnce({
      status: 'ok',
      booking: { ...booking, status: 'CANCELLED' },
      items: booking.items,
      released: 1,
      message: 'Booking cancelled and seats released',
    })

    render(
      <MemoryRouter initialEntries={['/bookings']}>
        <App />
      </MemoryRouter>
    )

    expect(await screen.findByText(/BK-ABC123/)).toBeInTheDocument()
    await userAction.click(screen.getByRole('button', { name: 'Cancel booking' }))
    expect(await screen.findByText(/seats released/)).toBeInTheDocument()
    expect(mockedBookingApi.cancelBooking).toHaveBeenCalledWith(5)
  })
})
