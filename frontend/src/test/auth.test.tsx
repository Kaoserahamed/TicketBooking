import { describe, expect, it, vi, beforeEach } from 'vitest'
import api from '../api/client'
import { authApi, userApi } from '../api/auth'

vi.mock('../api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/client')>()
  const post = vi.fn()
  const get = vi.fn()
  const put = vi.fn()
  const mockApi = { post, get, put }
  return { ...actual, default: mockApi }
})

const mockedApi = vi.mocked(api, true)

const user = {
  id: 7,
  name: 'Asha Example',
  email: 'asha@example.com',
  phone: '+15551234567',
  role: 'USER' as const,
  status: 'ACTIVE' as const,
  emailVerified: false,
  emailVerifiedAt: null,
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

// STEP 1 — auth service frontend (docs/04-api-design.md §4.2).
// Backend already implements /auth/* and /users/me*; these tests pin the
// frontend to the real request/response contract (envelopes included).
describe('auth service frontend', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('logs in with email/password and unwraps { user, tokens }', async () => {
    mockedApi.post.mockResolvedValueOnce({ data: { status: 'ok', user, tokens } })
    const result = await authApi.login('asha@example.com', 'Secret123')
    expect(mockedApi.post).toHaveBeenCalledWith('/auth/login', {
      email: 'asha@example.com',
      password: 'Secret123',
    })
    expect(result.user.email).toBe('asha@example.com')
    expect(result.tokens.accessToken).toBe('access-123')
  })

  it('registers with name/email/phone/password', async () => {
    mockedApi.post.mockResolvedValueOnce({ data: { status: 'ok', user, tokens } })
    const result = await authApi.register({
      name: 'Asha Example',
      email: 'asha@example.com',
      phone: '+15551234567',
      password: 'Secret123',
    })
    expect(mockedApi.post).toHaveBeenCalledWith('/auth/register', {
      name: 'Asha Example',
      email: 'asha@example.com',
      phone: '+15551234567',
      password: 'Secret123',
    })
    expect(result.user.name).toBe('Asha Example')
  })

  it('fetches the profile from /auth/me and unwraps { user }', async () => {
    mockedApi.get.mockResolvedValueOnce({ data: { status: 'ok', user } })
    const result = await authApi.getMe()
    expect(mockedApi.get).toHaveBeenCalledWith('/auth/me')
    expect(result.id).toBe(7)
  })

  it('updates the profile via PUT /users/me', async () => {
    mockedApi.put.mockResolvedValueOnce({ data: { status: 'ok', user } })
    const result = await userApi.updateProfile({ name: 'Asha New' })
    expect(mockedApi.put).toHaveBeenCalledWith('/users/me', { name: 'Asha New' })
    expect(result.name).toBe('Asha Example')
  })

  it('changes the password and returns the backend message', async () => {
    mockedApi.put.mockResolvedValueOnce({
      data: { status: 'ok', message: 'Password updated.' },
    })
    const message = await userApi.changePassword('Secret123', 'NewSecret456')
    expect(mockedApi.put).toHaveBeenCalledWith('/users/me/password', {
      currentPassword: 'Secret123',
      newPassword: 'NewSecret456',
    })
    expect(message).toBe('Password updated.')
  })

  it('covers the recovery flow endpoints', async () => {
    mockedApi.post.mockResolvedValueOnce({ data: { status: 'ok', message: 'sent', user } })
    await authApi.verifyEmail('token-1')
    expect(mockedApi.post).toHaveBeenCalledWith('/auth/verify-email', { token: 'token-1' })

    mockedApi.post.mockResolvedValueOnce({ data: { status: 'ok', message: 'sent' } })
    await authApi.forgotPassword('asha@example.com')
    expect(mockedApi.post).toHaveBeenCalledWith('/auth/forgot-password', {
      email: 'asha@example.com',
    })

    mockedApi.post.mockResolvedValueOnce({ data: { status: 'ok', message: 'reset' } })
    await authApi.resetPassword('token-2', 'NewSecret456')
    expect(mockedApi.post).toHaveBeenCalledWith('/auth/reset-password', {
      token: 'token-2',
      newPassword: 'NewSecret456',
    })
  })
})
