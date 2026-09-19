import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import App from '../App'
import config from '../../vite.config'

// STEP 0 — frontend baseline config check.
// This is the mandatory "test the setup" module: it verifies the Vite + React
// + Router + Tailwind skeleton boots before any service UI is built.
describe('frontend setup', () => {
  it('has the dev-server proxy for /api and happy-dom test env', () => {
    expect(config.server?.port).toBe(5173)
    const target = (config.server?.proxy as Record<string, { target: string }>)['/api']
      ?.target
    expect(target).toBe('http://localhost:4000')
    expect(config.test?.environment).toBe('happy-dom')
  })

  it('renders the home page shell', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>,
    )
    expect(screen.getByText('Ticket Booking System')).toBeInTheDocument()
    expect(screen.getByText('Browse events')).toBeInTheDocument()
  })

  it('exposes protected routes that redirect to login when unauthenticated', () => {
    localStorage.clear()
    render(
      <MemoryRouter initialEntries={['/bookings']}>
        <App />
      </MemoryRouter>,
    )
    expect(screen.getByRole('heading', { name: 'Login' })).toBeInTheDocument()
  })
})
