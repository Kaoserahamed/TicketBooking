import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import App from '../App'
import { venueApi } from '../api/venues'

vi.mock('../api/venues', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/venues')>()
  return {
    ...actual,
    venueApi: {
      listVenues: vi.fn(),
      getVenue: vi.fn(),
      listSeats: vi.fn(),
    },
  }
})

const mockedVenueApi = vi.mocked(venueApi, true)

const venue = {
  id: 2,
  name: 'Grand Hall',
  address: '1 Main St',
  city: 'Dhaka',
  capacity: 500,
  createdAt: '2026-01-01T00:00:00.000Z',
  seats: {
    total: 2,
    byType: { VIP: 1, PREMIUM: 1, REGULAR: 0, BALCONY: 0, BOX: 0 },
  },
}

const vipSeat = {
  id: 20,
  venueId: 2,
  row: 'A',
  number: '1',
  label: 'A1',
  seatType: 'VIP' as const,
  createdAt: '2026-01-01T00:00:00.000Z',
}

const premiumSeat = {
  id: 21,
  venueId: 2,
  row: 'B',
  number: '2',
  label: 'B2',
  seatType: 'PREMIUM' as const,
  createdAt: '2026-01-01T00:00:00.000Z',
}

describe('venues pages', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the venue catalogue with city filter and pagination', async () => {
    const userAction = userEvent.setup()
    mockedVenueApi.listVenues
      .mockResolvedValueOnce({
        status: 'ok',
        venues: [venue],
        total: 13,
        limit: 12,
        offset: 0,
      })
      .mockResolvedValueOnce({
        status: 'ok',
        venues: [],
        total: 0,
        limit: 12,
        offset: 0,
      })

    render(
      <MemoryRouter initialEntries={['/venues']}>
        <App />
      </MemoryRouter>,
    )

    expect(await screen.findByRole('link', { name: 'Grand Hall' })).toHaveAttribute('href', '/venues/2')
    expect(screen.getByText('Page 1 of 2 (13 venues)')).toBeInTheDocument()

    await userAction.type(screen.getByLabelText('Filter by city'), 'Dhaka')
    await userAction.click(screen.getByRole('button', { name: 'Search' }))

    await waitFor(() => {
      expect(mockedVenueApi.listVenues).toHaveBeenLastCalledWith({
        city: 'Dhaka',
        search: undefined,
        limit: 12,
        offset: 0,
      })
    })
    expect(await screen.findByText('No venues found.')).toBeInTheDocument()
  })

  it('renders one venue with its seat layout grouped by row', async () => {
    mockedVenueApi.getVenue.mockResolvedValueOnce(venue)
    mockedVenueApi.listSeats.mockResolvedValueOnce({
      status: 'ok',
      venueId: 2,
      seats: [vipSeat, premiumSeat],
      total: 2,
      limit: 100,
      offset: 0,
    })

    render(
      <MemoryRouter initialEntries={['/venues/2']}>
        <App />
      </MemoryRouter>,
    )

    expect(await screen.findByRole('heading', { name: 'Grand Hall' })).toBeInTheDocument()
    expect(screen.getByText(/Dhaka/)).toHaveTextContent('1 Main St, Dhaka · capacity 500')
    expect(screen.getByText('Row A')).toBeInTheDocument()
    expect(screen.getByText('A1')).toBeInTheDocument()
    expect(screen.getByText('Row B')).toBeInTheDocument()
    expect(screen.getByText('B2')).toBeInTheDocument()
  })

  it('filters seats by type on the venue detail page', async () => {
    const userAction = userEvent.setup()
    mockedVenueApi.getVenue.mockResolvedValueOnce(venue)
    mockedVenueApi.listSeats
      .mockResolvedValueOnce({
        status: 'ok',
        venueId: 2,
        seats: [vipSeat, premiumSeat],
        total: 2,
        limit: 100,
        offset: 0,
      })
      .mockResolvedValueOnce({
        status: 'ok',
        venueId: 2,
        seats: [vipSeat],
        total: 1,
        limit: 100,
        offset: 0,
      })

    render(
      <MemoryRouter initialEntries={['/venues/2']}>
        <App />
      </MemoryRouter>,
    )

    await screen.findByRole('heading', { name: 'Grand Hall' })

    await userAction.selectOptions(screen.getByLabelText('Filter seats by type'), 'VIP')

    await waitFor(() => {
      expect(mockedVenueApi.listSeats).toHaveBeenLastCalledWith(2, { seatType: 'VIP', limit: 100 })
    })
    expect(await screen.findByText('A1')).toBeInTheDocument()
  })

  it('shows backend errors on the venue detail page', async () => {
    mockedVenueApi.getVenue.mockRejectedValueOnce({
      response: { data: { message: 'Venue not found' } },
    })
    mockedVenueApi.listSeats.mockResolvedValueOnce({
      status: 'ok',
      venueId: 999,
      seats: [],
      total: 0,
      limit: 100,
      offset: 0,
    })

    render(
      <MemoryRouter initialEntries={['/venues/999']}>
        <App />
      </MemoryRouter>,
    )

    expect(await screen.findByRole('alert')).toHaveTextContent('Venue not found')
  })
})
