import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import App from '../App'
import { showApi } from '../api/shows'
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

const mockedShowApi = vi.mocked(showApi, true)

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
  seats: { total: 4, available: 2, held: 1, booked: 1, blocked: 0 },
}

const seats = [
  { showSeatId: 101, showId: 11, seatId: 1, row: 'A', number: '1', label: 'A1', seatType: 'REGULAR', price: '100.00', status: 'AVAILABLE' as const, holdExpiresAt: null },
  { showSeatId: 102, showId: 11, seatId: 2, row: 'A', number: '2', label: 'A2', seatType: 'VIP', price: '250.00', status: 'BOOKED' as const, holdExpiresAt: null },
  { showSeatId: 103, showId: 11, seatId: 3, row: 'B', number: '1', label: 'B1', seatType: 'REGULAR', price: '100.00', status: 'HELD' as const, holdExpiresAt: null },
]

const availability = {
  showId: 11,
  total: 4,
  available: 2,
  held: 1,
  booked: 1,
  blocked: 0,
  byRow: [
    { row: 'A', total: 2, available: 1, held: 0, booked: 1, blocked: 0 },
    { row: 'B', total: 2, available: 1, held: 1, booked: 0, blocked: 0 },
  ],
}

describe('show detail page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuthStore.setState({ user: null, token: null, refreshToken: null, error: null })
  })

  it('renders counts, groups seats by row, and filters by status', async () => {
    const userAction = userEvent.setup()
    mockedShowApi.getShow.mockResolvedValueOnce(show)
    mockedShowApi.getSeatMap.mockResolvedValueOnce({ status: 'ok', showId: 11, total: 3, seats })
    mockedShowApi.getAvailability.mockResolvedValueOnce(availability)

    render(
      <MemoryRouter initialEntries={['/shows/11']}>
        <App />
      </MemoryRouter>,
    )

    expect(await screen.findByRole('heading', { name: 'Rock Night' })).toBeInTheDocument()
    expect(screen.getByText('Seat map (3)')).toBeInTheDocument()
    expect(screen.getByText('Row A')).toBeInTheDocument()
    expect(screen.getByText('A1')).toBeInTheDocument()

    await userAction.selectOptions(screen.getByLabelText('Filter seats by status'), 'BOOKED')
    expect(screen.getByText('A2')).toBeInTheDocument()
    expect(screen.queryByText('A1')).not.toBeInTheDocument()
  })

  it('asks signed-out users to sign in instead of showing the book link', async () => {
    mockedShowApi.getShow.mockResolvedValueOnce(show)
    mockedShowApi.getSeatMap.mockResolvedValueOnce({ status: 'ok', showId: 11, total: 3, seats })
    mockedShowApi.getAvailability.mockResolvedValueOnce(availability)

    render(
      <MemoryRouter initialEntries={['/shows/11']}>
        <App />
      </MemoryRouter>,
    )

    expect(await screen.findByText('to book seats for this show.')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Book this show' })).not.toBeInTheDocument()
  })

  it('shows backend errors', async () => {
    mockedShowApi.getShow.mockRejectedValueOnce({
      response: { data: { message: 'Show not found' } },
    })
    mockedShowApi.getSeatMap.mockResolvedValueOnce({ status: 'ok', showId: 11, total: 0, seats: [] })
    mockedShowApi.getAvailability.mockResolvedValueOnce({ ...availability, total: 0 })

    render(
      <MemoryRouter initialEntries={['/shows/999']}>
        <App />
      </MemoryRouter>,
    )

    expect(await screen.findByRole('alert')).toHaveTextContent('Show not found')
  })
})
