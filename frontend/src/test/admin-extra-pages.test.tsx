import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import AdminShowsPage from '../pages/AdminShowsPage'
import AdminVenueSeatsPage from '../pages/AdminVenueSeatsPage'
import { adminApi } from '../api/admin'
import { showApi } from '../api/shows'
import { eventApi } from '../api/events'
import { venueApi } from '../api/venues'

vi.mock('../api/admin', () => ({
  adminApi: {
    createShow: vi.fn(),
    updateShow: vi.fn(),
    createSeat: vi.fn(),
    updateSeat: vi.fn(),
    deleteSeat: vi.fn(),
  },
}))
vi.mock('../api/shows', () => ({ showApi: { listShows: vi.fn() } }))
vi.mock('../api/events', () => ({ eventApi: { listEvents: vi.fn() } }))
vi.mock('../api/venues', () => ({
  venueApi: { listVenues: vi.fn(), getVenue: vi.fn(), listSeats: vi.fn() },
}))

const adminApiMock = vi.mocked(adminApi, true)
const showApiMock = vi.mocked(showApi, true)
const eventApiMock = vi.mocked(eventApi, true)
const venueApiMock = vi.mocked(venueApi, true)

const showRow = {
  id: 11,
  eventId: 3,
  event: { id: 3, name: 'Rock Night', status: 'PUBLISHED' },
  venueId: 4,
  venue: { id: 4, name: 'Grand Hall', address: '12 Road', city: 'Dhaka', capacity: 500 },
  startTime: '2026-12-01 18:00:00',
  endTime: '2026-12-01 21:00:00',
  status: 'SCHEDULED',
  createdAt: '',
  seats: { total: 60, available: 50, held: 2, booked: 8, blocked: 0 },
}

const seatRow = {
  id: 12,
  venueId: 4,
  row: 'A',
  number: '5',
  label: 'A5',
  seatType: 'REGULAR' as const,
  createdAt: '',
}

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('AdminShowsPage', () => {
  it('renders the shows table and the create form dropdowns', async () => {
    showApiMock.listShows.mockResolvedValueOnce({
      status: 'ok',
      shows: [showRow],
      total: 1,
      limit: 10,
      offset: 0,
    })
    eventApiMock.listEvents.mockResolvedValueOnce({
      status: 'ok',
      events: [{ id: 3, name: 'Rock Night' } as never],
      total: 1,
      limit: 100,
      offset: 0,
    })
    venueApiMock.listVenues.mockResolvedValueOnce({
      status: 'ok',
      venues: [{ id: 4, name: 'Grand Hall', city: 'Dhaka' } as never],
      total: 1,
      limit: 100,
      offset: 0,
    })

    render(
      <MemoryRouter initialEntries={['/admin/shows']}>
        <AdminShowsPage />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Rock Night')).toBeInTheDocument()
    })
    expect(showApiMock.listShows).toHaveBeenCalledWith({ limit: 10, offset: 0 })
    expect(screen.getByText('50/60 available')).toBeInTheDocument()
    expect(screen.getByText('Grand Hall, Dhaka')).toBeInTheDocument()
  })

  it('creates a show with a backend-formatted datetime', async () => {
    showApiMock.listShows.mockResolvedValue({
      status: 'ok',
      shows: [],
      total: 0,
      limit: 10,
      offset: 0,
    })
    eventApiMock.listEvents.mockResolvedValue({
      status: 'ok',
      events: [{ id: 3, name: 'Rock Night' } as never],
      total: 1,
      limit: 100,
      offset: 0,
    })
    venueApiMock.listVenues.mockResolvedValue({
      status: 'ok',
      venues: [{ id: 4, name: 'Grand Hall', city: 'Dhaka' } as never],
      total: 1,
      limit: 100,
      offset: 0,
    })
    adminApiMock.createShow.mockResolvedValueOnce(showRow as never)

    render(
      <MemoryRouter initialEntries={['/admin/shows']}>
        <AdminShowsPage />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getByLabelText('Show event')).toBeInTheDocument()
    })
    // The event/venue <option>s render only after their dropdown data loads;
    // selecting a not-yet-rendered option would silently no-op.
    await screen.findByRole('option', { name: /Rock Night/ })
    await screen.findByRole('option', { name: /Grand Hall/ })

    const user = userEvent.setup()
    await user.selectOptions(screen.getByLabelText('Show event'), '3')
    await user.selectOptions(screen.getByLabelText('Show venue'), '4')
    fireEvent.change(screen.getByLabelText('Show start time'), {
      target: { value: '2026-12-01T18:00' },
    })
    fireEvent.change(screen.getByLabelText('Show end time'), {
      target: { value: '2026-12-01T21:00' },
    })
    // happy-dom blocks click-submits on this form (datetime-local/select
    // constraint validation quirks) — dispatch the submit event directly.
    fireEvent.submit(screen.getByRole('button', { name: 'Create show' }).closest('form')!)
    await user.click(screen.getByRole('button', { name: 'Create show' }))

    await waitFor(() => {
      expect(adminApiMock.createShow).toHaveBeenCalledWith({
        eventId: 3,
        venueId: 4,
        startTime: '2026-12-01 18:00:00',
        endTime: '2026-12-01 21:00:00',
        status: 'SCHEDULED',
        provisionInventory: true,
        defaultPrice: 100,
      })
    })
    expect(await screen.findByText('Show #11 created for Rock Night')).toBeInTheDocument()
  })

  it('changes a show status inline via updateShow', async () => {
    showApiMock.listShows.mockResolvedValueOnce({
      status: 'ok',
      shows: [showRow],
      total: 1,
      limit: 10,
      offset: 0,
    })
    eventApiMock.listEvents.mockResolvedValueOnce({
      status: 'ok',
      events: [],
      total: 0,
      limit: 100,
      offset: 0,
    })
    venueApiMock.listVenues.mockResolvedValueOnce({
      status: 'ok',
      venues: [],
      total: 0,
      limit: 100,
      offset: 0,
    })
    adminApiMock.updateShow.mockResolvedValueOnce({ ...showRow, status: 'ONGOING' } as never)

    render(
      <MemoryRouter initialEntries={['/admin/shows']}>
        <AdminShowsPage />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getByLabelText('Status for show 11')).toBeInTheDocument()
    })

    const user = userEvent.setup()
    await user.selectOptions(screen.getByLabelText('Status for show 11'), 'ONGOING')

    await waitFor(() => {
      expect(adminApiMock.updateShow).toHaveBeenCalledWith(11, { status: 'ONGOING' })
    })
    expect(await screen.findByText('Show #11 status set to ONGOING')).toBeInTheDocument()
  })
})

describe('AdminVenueSeatsPage', () => {
  const venueRow = {
    id: 4,
    name: 'Grand Hall',
    address: '12 Road',
    city: 'Dhaka',
    capacity: 500,
    createdAt: '',
    updatedAt: '',
    seats: { total: 1, byType: {} },
  }
  const seatsResponse = {
    status: 'ok' as const,
    venueId: 4,
    total: 1,
    limit: 500,
    offset: 0,
    seats: [seatRow],
  }

  it('loads the venue, seat table and adds a seat', async () => {
    venueApiMock.getVenue.mockResolvedValueOnce(venueRow)
    venueApiMock.listSeats.mockResolvedValue(seatsResponse as never)
    adminApiMock.createSeat.mockResolvedValueOnce({
      id: 13,
      venueId: 4,
      row: 'B',
      number: '1',
      label: 'B1',
      seatType: 'REGULAR',
      createdAt: '',
    } as never)

    render(
      <MemoryRouter initialEntries={['/admin/venues/4/seats']}>
        <Routes>
          <Route path="/admin/venues/:id/seats" element={<AdminVenueSeatsPage />} />
        </Routes>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(venueApiMock.getVenue).toHaveBeenCalledWith(4)
    })
    expect(await screen.findByText('A5')).toBeInTheDocument()
    expect(screen.getByText('Grand Hall — Dhaka (capacity 500)')).toBeInTheDocument()

    const user = userEvent.setup()
    await user.type(screen.getByLabelText('Row number'), 'B')
    await user.type(screen.getByLabelText('Seat number'), '1')
    await user.click(screen.getByRole('button', { name: 'Add seat' }))

    await waitFor(() => {
      expect(adminApiMock.createSeat).toHaveBeenCalledWith(4, {
        rowNumber: 'B',
        seatNumber: '1',
        seatType: 'REGULAR',
      })
    })
    expect(await screen.findByText('Seat B1 added')).toBeInTheDocument()
    expect(venueApiMock.listSeats).toHaveBeenCalledTimes(2)
  })

  it('updates a seat type inline and deletes seats', async () => {
    venueApiMock.getVenue.mockResolvedValue(venueRow)
    venueApiMock.listSeats.mockResolvedValue(seatsResponse as never)
    adminApiMock.updateSeat.mockResolvedValueOnce({ ...seatRow, seatType: 'VIP' } as never)
    adminApiMock.deleteSeat.mockResolvedValueOnce('Seat deleted')

    render(
      <MemoryRouter initialEntries={['/admin/venues/4/seats']}>
        <Routes>
          <Route path="/admin/venues/:id/seats" element={<AdminVenueSeatsPage />} />
        </Routes>
      </MemoryRouter>
    )
    expect(await screen.findByText('A5')).toBeInTheDocument()

    const user = userEvent.setup()
    await user.selectOptions(screen.getByLabelText('Seat type for A5'), 'VIP')

    await waitFor(() => {
      expect(adminApiMock.updateSeat).toHaveBeenCalledWith(4, 12, 'VIP')
    })
    expect(await screen.findByText('Seat #12 type set to VIP')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Delete' }))
    await waitFor(() => {
      expect(adminApiMock.deleteSeat).toHaveBeenCalledWith(4, 12)
    })
    expect(await screen.findByText('Seat deleted')).toBeInTheDocument()
    expect(screen.queryByText('A5')).not.toBeInTheDocument()
  })

  it('shows an alert for an invalid venue id', () => {
    render(
      <MemoryRouter initialEntries={['/admin/venues/abc/seats']}>
        <Routes>
          <Route path="/admin/venues/:id/seats" element={<AdminVenueSeatsPage />} />
        </Routes>
      </MemoryRouter>
    )
    expect(screen.getByRole('alert')).toHaveTextContent('Invalid venue id')
  })
})
