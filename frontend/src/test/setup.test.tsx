import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import App from '../App'
import config from '../../vite.config'
import { eventApi } from '../api/events'
import { showApi } from '../api/shows'

vi.mock('../api/events', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/events')>()
  return {
    ...actual,
    eventApi: {
      listEvents: vi.fn(),
      getEvent: vi.fn(),
      getEventShows: vi.fn(),
    },
  }
})

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

vi.mocked(eventApi.listEvents).mockResolvedValue({
  status: 'ok',
  events: [],
  total: 0,
  limit: 6,
  offset: 0,
})
vi.mocked(showApi.listShows).mockResolvedValue({
  status: 'ok',
  shows: [],
  total: 0,
  limit: 6,
  offset: 0,
})

// STEP 0 — frontend baseline config check.
// This is the mandatory "test the setup" module: it verifies the Vite + React
// + Router + Tailwind skeleton boots before any service UI is built.
describe('frontend setup', () => {
  it('has the dev-server proxy for /api and happy-dom test env', () => {
    expect(config.server?.port).toBe(5173)
    const target = (config.server?.proxy as Record<string, { target: string }>)['/api']?.target
    expect(target).toBe('http://localhost:4000')
    expect(config.test?.environment).toBe('happy-dom')
  })

  it('renders the home page shell', async () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>
    )
    expect(screen.getByText('Ticket Booking System')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Browse events' })).toBeInTheDocument()
  })

  it('exposes protected routes that redirect to login when unauthenticated', () => {
    localStorage.clear()
    render(
      <MemoryRouter initialEntries={['/bookings']}>
        <App />
      </MemoryRouter>
    )
    expect(screen.getByRole('heading', { name: 'Login' })).toBeInTheDocument()
  })
})
