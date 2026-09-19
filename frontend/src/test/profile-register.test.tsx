import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import ProfilePage from '../pages/ProfilePage'
import RegisterPage from '../pages/RegisterPage'
import { authApi, userApi } from '../api/auth'
import type { TokenPair, User } from '../api/auth'
import { useAuthStore } from '../stores/auth'

vi.mock('../api/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/auth')>()
  return {
    ...actual,
    authApi: {
      ...actual.authApi,
      getMe: vi.fn(),
      register: vi.fn(),
      resendVerification: vi.fn(),
    },
    userApi: {
      ...actual.userApi,
      updateProfile: vi.fn(),
      changePassword: vi.fn(),
    },
  }
})

const mockedAuthApi = vi.mocked(authApi, true)
const mockedUserApi = vi.mocked(userApi, true)

const user: User = {
  id: 7,
  name: 'Asha Example',
  email: 'asha@example.com',
  phone: null,
  role: 'USER',
  status: 'ACTIVE',
  emailVerified: true,
  emailVerifiedAt: '2026-01-02T00:00:00.000Z',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

const tokens: TokenPair = {
  tokenType: 'Bearer',
  accessToken: 'access-123',
  refreshToken: 'refresh-123',
  accessTokenExpiresIn: '15m',
  refreshTokenExpiresAt: '2026-01-08T00:00:00.000Z',
}

function resetStore(overrides: Partial<ReturnType<typeof useAuthStore.getState>> = {}) {
  useAuthStore.setState({
    user: null,
    token: null,
    refreshToken: null,
    isLoading: false,
    error: null,
    ...overrides,
  })
}

function renderRegister() {
  return render(
    <MemoryRouter initialEntries={['/register']}>
      <RegisterPage />
    </MemoryRouter>
  )
}

async function renderLoadedProfile() {
  const view = render(<ProfilePage />)
  await waitFor(() => expect(screen.getByLabelText('Full name')).toHaveValue(user.name))
  return view
}

describe('register page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    resetStore()
  })

  it('registers a new account and stores the returned session', async () => {
    const userAction = userEvent.setup()
    mockedAuthApi.register.mockResolvedValueOnce({ status: 'ok', user, tokens })

    renderRegister()

    await userAction.type(screen.getByLabelText('Full name'), 'Asha Example')
    await userAction.type(screen.getByLabelText('Email'), 'asha@example.com')
    await userAction.type(screen.getByLabelText('Phone (optional)'), '+15551234567')
    await userAction.type(screen.getByLabelText('Password'), 'Secret123')
    await userAction.click(screen.getByRole('button', { name: 'Register' }))

    await waitFor(() =>
      expect(mockedAuthApi.register).toHaveBeenCalledWith({
        name: 'Asha Example',
        email: 'asha@example.com',
        phone: '+15551234567',
        password: 'Secret123',
      })
    )
    expect(localStorage.getItem('accessToken')).toBe('access-123')
    expect(localStorage.getItem('refreshToken')).toBe('refresh-123')
  })

  it('omits the phone number when the optional field is left empty', async () => {
    const userAction = userEvent.setup()
    mockedAuthApi.register.mockResolvedValueOnce({ status: 'ok', user, tokens })

    renderRegister()

    await userAction.type(screen.getByLabelText('Full name'), 'Asha Example')
    await userAction.type(screen.getByLabelText('Email'), 'asha@example.com')
    await userAction.type(screen.getByLabelText('Password'), 'Secret123')
    await userAction.click(screen.getByRole('button', { name: 'Register' }))

    await waitFor(() =>
      expect(mockedAuthApi.register).toHaveBeenCalledWith({
        name: 'Asha Example',
        email: 'asha@example.com',
        phone: undefined,
        password: 'Secret123',
      })
    )
  })

  it('shows the backend error when registration is rejected', async () => {
    const userAction = userEvent.setup()
    mockedAuthApi.register.mockRejectedValueOnce({
      response: { data: { message: 'Email already registered' } },
    })

    renderRegister()

    await userAction.type(screen.getByLabelText('Full name'), 'Asha Example')
    await userAction.type(screen.getByLabelText('Email'), 'asha@example.com')
    await userAction.type(screen.getByLabelText('Password'), 'Secret123')
    await userAction.click(screen.getByRole('button', { name: 'Register' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Email already registered')
  })
})

describe('profile page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    resetStore({ token: 'access-123' })
  })

  it('shows a loading placeholder while the profile request is in flight', async () => {
    mockedAuthApi.getMe.mockReturnValueOnce(new Promise<User>(() => {}))

    render(<ProfilePage />)

    expect(await screen.findByText('Loading profile…')).toBeInTheDocument()
  })

  it('loads the signed-in user into the account form', async () => {
    mockedAuthApi.getMe.mockResolvedValueOnce(user)

    render(<ProfilePage />)

    await waitFor(() => expect(screen.getByLabelText('Full name')).toHaveValue('Asha Example'))
    expect(screen.getByLabelText('Email')).toHaveValue('asha@example.com')
    expect(screen.getByLabelText('Phone')).toHaveValue('')
    expect(screen.getByText(/verified/)).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Resend verification email' })
    ).not.toBeInTheDocument()
  })

  it('reports that there is nothing to save when the form is untouched', async () => {
    const userAction = userEvent.setup()
    mockedAuthApi.getMe.mockResolvedValueOnce(user)

    await renderLoadedProfile()
    await userAction.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(await screen.findByText('No changes to save.')).toBeInTheDocument()
    expect(mockedUserApi.updateProfile).not.toHaveBeenCalled()
  })

  it('sends only the changed fields when the form is saved', async () => {
    const userAction = userEvent.setup()
    mockedAuthApi.getMe.mockResolvedValueOnce(user)
    mockedUserApi.updateProfile.mockResolvedValueOnce({ ...user, name: 'Asha Updated' })

    await renderLoadedProfile()

    const nameInput = screen.getByLabelText('Full name')
    await userAction.clear(nameInput)
    await userAction.type(nameInput, 'Asha Updated')
    await userAction.click(screen.getByRole('button', { name: 'Save changes' }))

    await waitFor(() =>
      expect(mockedUserApi.updateProfile).toHaveBeenCalledWith({ name: 'Asha Updated' })
    )
    expect(await screen.findByText('Profile updated.')).toBeInTheDocument()
  })

  it('resends the verification email for an unverified account', async () => {
    const userAction = userEvent.setup()
    mockedAuthApi.getMe.mockResolvedValueOnce({
      ...user,
      emailVerified: false,
      emailVerifiedAt: null,
    })
    mockedAuthApi.resendVerification.mockResolvedValueOnce('Verification email sent.')

    render(<ProfilePage />)

    await userAction.click(await screen.findByRole('button', { name: 'Resend verification email' }))

    expect(await screen.findByText('Verification email sent.')).toBeInTheDocument()
  })

  it('surfaces an error when the verification email cannot be resent', async () => {
    const userAction = userEvent.setup()
    mockedAuthApi.getMe.mockResolvedValueOnce({
      ...user,
      emailVerified: false,
      emailVerifiedAt: null,
    })
    mockedAuthApi.resendVerification.mockRejectedValueOnce({
      response: { data: { message: 'Mailbox unavailable' } },
    })

    render(<ProfilePage />)

    await userAction.click(await screen.findByRole('button', { name: 'Resend verification email' }))

    expect(await screen.findByText('Mailbox unavailable')).toBeInTheDocument()
  })

  it('changes the password and drops the stored session', async () => {
    const userAction = userEvent.setup()
    localStorage.setItem('accessToken', 'access-123')
    localStorage.setItem('refreshToken', 'refresh-123')
    mockedAuthApi.getMe.mockResolvedValueOnce(user)
    mockedUserApi.changePassword.mockResolvedValueOnce('Password changed.')

    await renderLoadedProfile()

    await userAction.type(screen.getByLabelText('Current password'), 'OldPass123')
    await userAction.type(screen.getByLabelText('New password'), 'NewPass456')
    await userAction.click(screen.getByRole('button', { name: 'Update password' }))

    await waitFor(() =>
      expect(mockedUserApi.changePassword).toHaveBeenCalledWith('OldPass123', 'NewPass456')
    )
    expect(useAuthStore.getState().user).toBeNull()
    expect(localStorage.getItem('accessToken')).toBeNull()
    expect(localStorage.getItem('refreshToken')).toBeNull()
  })

  it('shows an error alert when the profile cannot be loaded', async () => {
    mockedAuthApi.getMe.mockRejectedValueOnce({
      response: { data: { message: 'Session expired' } },
    })

    render(<ProfilePage />)

    expect(await screen.findByRole('alert')).toHaveTextContent('Session expired')
  })
})
