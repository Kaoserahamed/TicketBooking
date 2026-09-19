import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import AdminUsersPage from '../pages/AdminUsersPage'
import AdminEventsPage from '../pages/AdminEventsPage'
import AdminVenuesPage from '../pages/AdminVenuesPage'
import AdminBookingsPage from '../pages/AdminBookingsPage'
import { adminApi } from '../api/admin'
import { venueApi } from '../api/venues'

vi.mock('../api/admin', () => ({
  adminApi: {
    listUsers: vi.fn(),
    listEvents: vi.fn(),
    createEvent: vi.fn(),
    updateEvent: vi.fn(),
    createVenue: vi.fn(),
    updateVenue: vi.fn(),
    createSeat: vi.fn(),
    updateSeat: vi.fn(),
    deleteSeat: vi.fn(),
    createShow: vi.fn(),
    updateShow: vi.fn(),
    listBookings: vi.fn(),
  },
}))

vi.mock('../api/venues', () => ({
  venueApi: {
    listVenues: vi.fn(),
    getVenue: vi.fn(),
    listSeats: vi.fn(),
  },
}))

const adminApiMock = vi.mocked(adminApi, true)
const venueApiMock = vi.mocked(venueApi, true)

const eventRow = {
  id: 3, name: 'Rock Night', description: 'Desc', category: 'Concert',
  posterUrl: null, status: 'PUBLISHED' as const, createdAt: '', updatedAt: '',
}

const venueRow = {
  id: 4, name: 'Grand Hall', address: '12 Road', city: 'Dhaka',
  capacity: 500, createdAt: '', updatedAt: '', seats: { total: 500, byType: {} },
}

const bookingRow = {
  id: 5, userId: 2, showId: 11, bookingReference: 'BK-202609-0001', idempotencyKey: null,
  status: 'CONFIRMED' as const, subtotal: 300, discount: 0, totalAmount: 300, currency: 'BDT',
  expiresAt: null, createdAt: '', updatedAt: '',
  show: {
    id: 11, eventId: 3, venueId: 4,
    startTime: '2026-12-01 18:00:00', endTime: '2026-12-01 21:00:00', status: 'SCHEDULED',
    event: { id: 3, name: 'Rock Night', status: 'PUBLISHED' },
    venue: { id: 4, name: 'Grand Hall', address: null, city: 'Dhaka', capacity: 500 },
  },
  user: { id: 2, name: 'Regular Guy', email: 'guy@tbs.local' },
  items: [],
}

function renderPage(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>)
}

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  vi.clearAllMocks()
})

// ---------------------------------------------------------------------------
// AdminUsersPage — GET /admin/users?limit=100 (read-only, no mutation endpoint)
// ---------------------------------------------------------------------------
describe('AdminUsersPage', () => {
  it('lists users from { status, total, users }', async () => {
    adminApiMock.listUsers.mockResolvedValue({
      status: 'ok',
      total: 1,
      users: [{ id: 7, name: 'Regular Guy', email: 'guy@tbs.local', phone: null, role: 'USER', status: 'ACTIVE', emailVerified: false, emailVerifiedAt: null, createdAt: '', updatedAt: '' }],
    })

    renderPage(<AdminUsersPage />)

    expect(await screen.findByText('Regular Guy')).toBeTruthy()
    expect(screen.getByText('guy@tbs.local')).toBeTruthy()
    expect(adminApiMock.listUsers).toHaveBeenCalledWith({ limit: 100 })
  })
})

// ---------------------------------------------------------------------------
// AdminEventsPage — list + create through the form
// ---------------------------------------------------------------------------
describe('AdminEventsPage', () => {
  it('renders the admin event table and creates an event', async () => {
    adminApiMock.listEvents.mockResolvedValue({
      status: 'ok', total: 1, limit: 10, offset: 0, events: [eventRow],
    })
    adminApiMock.createEvent.mockResolvedValue(eventRow)

    renderPage(<AdminEventsPage />)
    expect(await screen.findByText('Rock Night')).toBeTruthy()
    expect(adminApiMock.listEvents).toHaveBeenCalledWith(expect.objectContaining({ limit: 10, offset: 0 }))

    await userEvent.type(screen.getByRole('textbox', { name: 'Event name' }), 'New Fest')
    await userEvent.click(screen.getByRole('button', { name: 'Create event' }))

    await waitFor(() =>
      expect(adminApiMock.createEvent).toHaveBeenCalledWith({
        name: 'New Fest',
        description: null,
        category: null,
        posterUrl: null,
        status: 'DRAFT',
      }),
    )
    expect(await screen.findByText('Event created: New Fest')).toBeTruthy()
  })
})

// ---------------------------------------------------------------------------
// AdminVenuesPage — public venue list + admin create
// ---------------------------------------------------------------------------
describe('AdminVenuesPage', () => {
  it('renders venues and creates one via POST /admin/venues', async () => {
    venueApiMock.listVenues.mockResolvedValue({
      status: 'ok', total: 1, limit: 10, offset: 0, venues: [venueRow],
    })
    adminApiMock.createVenue.mockResolvedValue(venueRow)

    renderPage(<AdminVenuesPage />)
    expect(await screen.findByText('Grand Hall')).toBeTruthy()
    expect(venueApiMock.listVenues).toHaveBeenCalledWith({ limit: 10, offset: 0 })

    await userEvent.type(screen.getByRole('textbox', { name: 'Venue name' }), 'Test Hall')
    await userEvent.type(screen.getByRole('textbox', { name: 'Venue city' }), 'Chattogram')
    await userEvent.type(screen.getByRole('spinbutton', { name: 'Venue capacity' }), '250')
    await userEvent.click(screen.getByRole('button', { name: 'Create venue' }))

    await waitFor(() =>
      expect(adminApiMock.createVenue).toHaveBeenCalledWith({
        name: 'Test Hall',
        city: 'Chattogram',
        address: null,
        capacity: 250,
      }),
    )
    expect(await screen.findByText('Venue created: Test Hall')).toBeTruthy()
  })
})

// ---------------------------------------------------------------------------
// AdminBookingsPage — table with customer info + status filter
// ---------------------------------------------------------------------------
describe('AdminBookingsPage', () => {
  it('lists bookings with customer info and applies the status filter', async () => {
    adminApiMock.listBookings
      .mockResolvedValueOnce({ status: 'ok', total: 1, bookings: [bookingRow] })
      .mockResolvedValue({ status: 'ok', total: 1, bookings: [bookingRow] })

    renderPage(<AdminBookingsPage />)
    expect(await screen.findByText('BK-202609-0001')).toBeTruthy()
    expect(screen.getByText(/Regular Guy/)).toBeTruthy()
    expect(screen.getByText(/guy@tbs\.local/)).toBeTruthy()
    expect(screen.getByText(/BDT 300\.00/)).toBeTruthy()
    expect(adminApiMock.listBookings).toHaveBeenCalledWith(expect.objectContaining({ limit: 10, offset: 0 }))

    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Filter by booking status' }), 'CONFIRMED')
    await userEvent.click(screen.getByRole('button', { name: 'Apply filters' }))
    await waitFor(() =>
      expect(adminApiMock.listBookings).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'CONFIRMED' })),
    )
  })
})

