import { describe, expect, it, vi } from 'vitest'
import api from '../api/client'
import { adminApi, type AdminRole, type CreateVenueInput, type CreateSeatInput, type CreateShowInput, type UpdateShowInput } from '../api/admin'

vi.mock('../api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/client')>()
  const post = vi.fn()
  const get = vi.fn()
  const put = vi.fn()
  const del = vi.fn()
  return { ...actual, default: { post, get, put, delete: del } }
})

const mockedApi = vi.mocked(api, true)
const mockedGet = mockedApi.get as ReturnType<typeof vi.fn>
const mockedPut = mockedApi.put as ReturnType<typeof vi.fn>
const mockedPost = mockedApi.post as ReturnType<typeof vi.fn>
const mockedDelete = (mockedApi as unknown as { delete: ReturnType<typeof vi.fn> }).delete

// ---------------------------------------------------------------------------
// Admin users — GET /admin/users (auth.validator.listUsersQuerySchema).
// Backend exposes NO user mutation endpoint — the list is read-only.
// ---------------------------------------------------------------------------
describe('adminApi.listUsers', () => {
  it('pins query params and unwraps { status, total, users }', async () => {
    mockedGet.mockResolvedValueOnce({
      data: {
        status: 'ok',
        total: 2,
        users: [
          { id: 1, name: 'Admin One', email: 'admin@tbs.local', phone: null, role: 'ADMIN', status: 'ACTIVE', emailVerified: true, emailVerifiedAt: '2026-01-01T00:00:00.000Z', createdAt: '', updatedAt: '' },
          { id: 2, name: 'Regular Guy', email: 'guy@tbs.local', phone: '0170000000', role: 'USER', status: 'INACTIVE', emailVerified: false, emailVerifiedAt: null, createdAt: '', updatedAt: '' },
        ],
      },
    })

    const data = await adminApi.listUsers({ role: 'ADMIN', status: 'ACTIVE', limit: 25 })

    expect(mockedGet).toHaveBeenCalledWith('/admin/users', {
      params: { role: 'ADMIN', status: 'ACTIVE', limit: 25 },
    })
    expect(data.total).toBe(2)
    expect(data.users[0]!.role).toBe('ADMIN')
    expect(data.users[1]!.status).toBe('INACTIVE')
  })

  it('strips empty filters so the Zod validator never sees them', async () => {
    mockedGet.mockResolvedValueOnce({ data: { status: 'ok', total: 0, users: [] } })

    await adminApi.listUsers({ role: '' as AdminRole, status: undefined, limit: 100 })

    expect(mockedGet).toHaveBeenCalledWith('/admin/users', {
      params: { limit: 100 },
    })
  })
})
// ---------------------------------------------------------------------------
// Admin events — list/create/update
// ---------------------------------------------------------------------------
describe('adminApi events', () => {
  it('listEvents strips empty filters and sends paging', async () => {
    mockedGet.mockResolvedValueOnce({
      data: {
        status: 'ok',
        total: 1,
        limit: 20,
        offset: 0,
        events: [{ id: 3, name: 'Rock Night', description: null, category: 'Concert', posterUrl: null, status: 'PUBLISHED', createdAt: '', updatedAt: '' }],
      },
    })

    const data = await adminApi.listEvents({ search: '', category: undefined, status: 'PUBLISHED', limit: 20, offset: 0 })

    expect(mockedGet).toHaveBeenCalledWith('/admin/events', {
      params: { status: 'PUBLISHED', limit: 20, offset: 0 },
    })
    expect(data.events[0]!.name).toBe('Rock Night')
  })

  it('createEvent posts the body and unwraps 201 { event }', async () => {
    mockedPost.mockResolvedValueOnce({
      data: { status: 'ok', event: { id: 9, name: 'New Gig', description: 'Desc', category: 'Concert', posterUrl: null, status: 'DRAFT', createdAt: '', updatedAt: '' } },
    })

    const event = await adminApi.createEvent({ name: 'New Gig', description: 'Desc', category: 'Concert', status: 'DRAFT' })

    expect(mockedPost).toHaveBeenCalledWith('/admin/events', { name: 'New Gig', description: 'Desc', category: 'Concert', status: 'DRAFT' })
    expect(event.id).toBe(9)
  })

  it('updateEvent PUTs only provided fields (backend requires ≥1 field)', async () => {
    mockedPut.mockResolvedValueOnce({
      data: { status: 'ok', event: { id: 3, name: 'Renamed', description: null, category: null, posterUrl: null, status: 'INACTIVE', createdAt: '', updatedAt: '' } },
    })

    const event = await adminApi.updateEvent(3, { name: 'Renamed', status: 'INACTIVE' })

    expect(mockedPut).toHaveBeenCalledWith('/admin/events/3', { name: 'Renamed', status: 'INACTIVE' })
    expect(event.status).toBe('INACTIVE')
  })
})

// ---------------------------------------------------------------------------
// Admin venues — create/update + seat CRUD
// ---------------------------------------------------------------------------
describe('adminApi venues and seats', () => {
  const venueInput: CreateVenueInput = { name: 'Grand Hall', city: 'Dhaka', address: '12 Road', capacity: 500 }

  it('createVenue posts the body and unwraps 201 { venue }', async () => {
    mockedPost.mockResolvedValueOnce({
      data: { status: 'ok', venue: { id: 4, name: 'Grand Hall', address: '12 Road', city: 'Dhaka', capacity: 500, seats: { total: 0, byType: {} } } },
    })

    const venue = await adminApi.createVenue(venueInput)

    expect(mockedPost).toHaveBeenCalledWith('/admin/venues', venueInput)
    expect(venue.capacity).toBe(500)
  })

  it('updateVenue PUTs partial changes and unwraps { venue }', async () => {
    mockedPut.mockResolvedValueOnce({
      data: { status: 'ok', venue: { id: 4, name: 'Grand Hall Renamed', address: null, city: 'Dhaka', capacity: 700 } },
    })

    const venue = await adminApi.updateVenue(4, { name: 'Grand Hall Renamed', capacity: 700 })

    expect(mockedPut).toHaveBeenCalledWith('/admin/venues/4', { name: 'Grand Hall Renamed', capacity: 700 })
    expect(venue.capacity).toBe(700)
  })

  it('createSeat posts { rowNumber, seatNumber, seatType } and unwraps 201 { seat }', async () => {
    mockedPost.mockResolvedValueOnce({
      data: { status: 'ok', seat: { id: 12, venueId: 4, row: 'A', number: '5', label: 'A5', seatType: 'VIP', createdAt: '' } },
    })

    const seat: CreateSeatInput = { rowNumber: 'A', seatNumber: '5', seatType: 'VIP' }
    const seatResult = await adminApi.createSeat(4, seat)

    expect(mockedPost).toHaveBeenCalledWith('/admin/venues/4/seats', seat)
    expect(seatResult.label).toBe('A5')
  })

  it('updateSeat PUTs { seatType } and deleteSeat unwraps { message }', async () => {
    mockedPut.mockResolvedValueOnce({
      data: { status: 'ok', seat: { id: 12, venueId: 4, row: 'A', number: '5', label: 'A5', seatType: 'BOX', createdAt: '' } },
    })
    mockedDelete.mockResolvedValueOnce({
      data: { status: 'ok', message: 'Seat deleted' },
    })

    const seat = await adminApi.updateSeat(4, 12, 'BOX')
    const message = await adminApi.deleteSeat(4, 12)

    expect(mockedPut).toHaveBeenCalledWith('/admin/venues/4/seats/12', { seatType: 'BOX' })
    expect(mockedDelete).toHaveBeenCalledWith('/admin/venues/4/seats/12')
    expect(seat.seatType).toBe('BOX')
    expect(message).toBe('Seat deleted')
  })
})

// ---------------------------------------------------------------------------
// Admin shows — create/update
// ---------------------------------------------------------------------------
describe('adminApi shows', () => {
  const showInput: CreateShowInput = {
    eventId: 3,
    venueId: 4,
    startTime: '2026-12-01 18:00:00',
    endTime: '2026-12-01 21:00:00',
    status: 'SCHEDULED',
    provisionInventory: true,
    defaultPrice: 150,
  }

  it('createShow posts the body and unwraps 201 { show } with seat summary', async () => {
    mockedPost.mockResolvedValueOnce({
      data: { status: 'ok', show: { id: 11, eventId: 3, venueId: 4, startTime: '2026-12-01 18:00:00', endTime: '2026-12-01 21:00:00', status: 'SCHEDULED', event: { id: 3, name: 'Rock Night', description: null, category: 'Concert', posterUrl: null, status: 'PUBLISHED', createdAt: '', updatedAt: '' }, venue: { id: 4, name: 'Grand Hall', address: null, city: 'Dhaka', capacity: 500 }, seats: { total: 500, available: 500, held: 0, booked: 0, blocked: 0, byType: {} } } },
    })

    const show = await adminApi.createShow(showInput)

    expect(mockedPost).toHaveBeenCalledWith('/admin/shows', showInput)
    expect(show.seats.available).toBe(500)
  })

  it('updateShow PUTs partial changes and unwraps { show }', async () => {
    mockedPut.mockResolvedValueOnce({
      data: { status: 'ok', show: { id: 11, eventId: 3, venueId: 4, startTime: '2026-12-02 18:00:00', endTime: '2026-12-02 21:00:00', status: 'CANCELLED', event: { id: 3, name: 'Rock Night', description: null, category: null, posterUrl: null, status: 'PUBLISHED', createdAt: '', updatedAt: '' }, venue: { id: 4, name: 'Grand Hall', address: null, city: 'Dhaka', capacity: 500 }, seats: { total: 500, available: 0, held: 0, booked: 0, blocked: 0, byType: {} } } },
    })

    const changes: UpdateShowInput = { status: 'CANCELLED' }
    const show = await adminApi.updateShow(11, changes)

    expect(mockedPut).toHaveBeenCalledWith('/admin/shows/11', { status: 'CANCELLED' })
    expect(show.status).toBe('CANCELLED')
  })
})

// ---------------------------------------------------------------------------
// Admin bookings — GET /admin/bookings (ADMIN only)
// ---------------------------------------------------------------------------
describe('adminApi.listBookings', () => {
  it('sends status filter and paging; unwraps { total, bookings } with user embedded', async () => {
    mockedGet.mockResolvedValueOnce({
      data: {
        status: 'ok',
        total: 1,
        bookings: [{
          id: 5, userId: 2, showId: 11, bookingReference: 'BK-202609-0001', idempotencyKey: null,
          status: 'CONFIRMED', subtotal: 300, discount: 0, totalAmount: 300, currency: 'BDT',
          expiresAt: null, createdAt: '', updatedAt: '',
          show: { id: 11, eventId: 3, venueId: 4, startTime: '2026-12-01 18:00:00', endTime: '2026-12-01 21:00:00', status: 'SCHEDULED', event: { id: 3, name: 'Rock Night', status: 'PUBLISHED' }, venue: { id: 4, name: 'Grand Hall', address: null, city: 'Dhaka', capacity: 500 } },
          user: { id: 2, name: 'Regular Guy', email: 'guy@tbs.local' },
          items: [],
        }],
      },
    })

    const data = await adminApi.listBookings({ status: 'CONFIRMED', limit: 10, offset: 0 })

    expect(mockedGet).toHaveBeenCalledWith('/admin/bookings', {
      params: { status: 'CONFIRMED', limit: 10, offset: 0 },
    })
    expect(data.total).toBe(1)
    expect(data.bookings[0]!.user?.email).toBe('guy@tbs.local')
  })
})


