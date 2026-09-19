import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import App from '../App'
import { authApi } from '../api/auth'
import { useAuthStore } from '../stores/auth'

vi.mock('../api/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/auth')>()
  return {
    ...actual,
    authApi: {
      ...actual.authApi,
      login: vi.fn(),
      register: vi.fn(),
      getMe: vi.fn(),
    },
    userApi: {
      ...actual.userApi,
      updateProfile: vi.fn(),
      changePassword: vi.fn(),
    },
  }
})

const mockedAuthApi = vi.mocked(authApi, true)

const user = {
  id: 7,
  name: 'Asha Example',
  email: 'asha@example.com',
  phone: null,
  role: 'USER' as const,
  status: 'ACTIVE' as const,
  emailVerified: true,
  emailVerifiedAt: '2026-01-02T00:00:00.000Z',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

const tokens = {
  tokenType: 'Bearer' as const,
  accessToken: 'access-123',
  refreshToken: 'refresh-123',
  accessTokenExpiresIn: '15m',
  refreshTokenExpiresAt: '2026-01-08T00:00:00.000Z',
}

describe('auth pages', () => {
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
  })

  it('signs in through the login form and stores tokens', async () => {
    const userAction = userEvent.setup()
    mockedAuthApi.login.mockResolvedValueOnce({ status: 'ok', user, tokens })

    render(
      <MemoryRouter initialEntries={['/login']}>
        <App />
      </MemoryRouter>,
    )

    await userAction.type(screen.getByLabelText('Email'), 'asha@example.com')
    await userAction.type(screen.getByLabelText('Password'), 'Secret123')
    await userAction.click(screen.getByRole('button', { name: 'Login' }))

    expect(mockedAuthApi.login).toHaveBeenCalledWith('asha@example.com', 'Secret123')
    expect(await screen.findByText('Discover events and book tickets in seconds.')).toBeInTheDocument()
    expect(localStorage.getItem('accessToken')).toBe('access-123')
    expect(localStorage.getItem('refreshToken')).toBe('refresh-123')
  })

  it('shows backend validation errors on the login form', async () => {
    const userAction = userEvent.setup()
    mockedAuthApi.login.mockRejectedValueOnce({
      response: { data: { message: 'Invalid email or password' } },
    })

    render(
      <MemoryRouter initialEntries={['/login']}>
        <App />
      </MemoryRouter>,
    )

    await userAction.type(screen.getByLabelText('Email'), 'asha@example.com')
    await userAction.type(screen.getByLabelText('Password'), 'wrong')
    await userAction.click(screen.getByRole('button', { name: 'Login' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid email or password')
  })

  it('redirects unauthenticated users away from /profile', () => {
    render(
      <MemoryRouter initialEntries={['/profile']}>
        <App />
      </MemoryRouter>,
    )
    expect(screen.getByRole('heading', { name: 'Login' })).toBeInTheDocument()
  })
})
