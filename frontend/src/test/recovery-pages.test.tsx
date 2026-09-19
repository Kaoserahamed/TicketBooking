import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import VerifyEmailPage from '../pages/VerifyEmailPage'
import ForgotPasswordPage from '../pages/ForgotPasswordPage'
import ResetPasswordPage from '../pages/ResetPasswordPage'
import { authApi } from '../api/auth'

vi.mock('../api/auth', () => ({
  authApi: {
    verifyEmail: vi.fn(),
    forgotPassword: vi.fn(),
    resetPassword: vi.fn(),
  },
}))

const authApiMock = vi.mocked(authApi, true)

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('VerifyEmailPage', () => {
  it('verifies the token from the query string', async () => {
    authApiMock.verifyEmail.mockResolvedValueOnce({ id: 1 } as never)

    render(
      <MemoryRouter initialEntries={['/verify-email?token=tok123']}>
        <VerifyEmailPage />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(authApiMock.verifyEmail).toHaveBeenCalledWith('tok123')
    })
    expect(await screen.findByText('Email address verified. You can now sign in.')).toBeInTheDocument()
  })

  it('shows an alert when the token is missing', () => {
    render(
      <MemoryRouter initialEntries={['/verify-email']}>
        <VerifyEmailPage />
      </MemoryRouter>,
    )

    expect(screen.getByRole('alert')).toHaveTextContent('Missing verification token.')
    expect(authApiMock.verifyEmail).not.toHaveBeenCalled()
  })
})

describe('ForgotPasswordPage', () => {
  it('sends the reset request for the entered email', async () => {
    authApiMock.forgotPassword.mockResolvedValueOnce('Reset link sent to your email')

    render(
      <MemoryRouter initialEntries={['/forgot-password']}>
        <ForgotPasswordPage />
      </MemoryRouter>,
    )

    const user = userEvent.setup()
    await user.type(screen.getByLabelText('Email'), 'user@tbs.local')
    await user.click(screen.getByRole('button', { name: 'Send reset link' }))

    await waitFor(() => {
      expect(authApiMock.forgotPassword).toHaveBeenCalledWith('user@tbs.local')
    })
    expect(await screen.findByText('Reset link sent to your email')).toBeInTheDocument()
  })

  it('shows backend errors in an alert', async () => {
    authApiMock.forgotPassword.mockRejectedValueOnce({
      response: { data: { message: 'Too many requests' } },
    })

    render(
      <MemoryRouter initialEntries={['/forgot-password']}>
        <ForgotPasswordPage />
      </MemoryRouter>,
    )

    const user = userEvent.setup()
    await user.type(screen.getByLabelText('Email'), 'user@tbs.local')
    await user.click(screen.getByRole('button', { name: 'Send reset link' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Too many requests')
  })
})

describe('ResetPasswordPage', () => {
  it('resets the password with the token from the query string', async () => {
    authApiMock.resetPassword.mockResolvedValueOnce('Password has been reset')

    render(
      <MemoryRouter initialEntries={['/reset-password?token=abc123']}>
        <ResetPasswordPage />
      </MemoryRouter>,
    )

    const user = userEvent.setup()
    await user.type(screen.getByLabelText('New password'), 'NewPassw0rd!')
    await user.click(screen.getByRole('button', { name: 'Reset password' }))

    await waitFor(() => {
      expect(authApiMock.resetPassword).toHaveBeenCalledWith('abc123', 'NewPassw0rd!')
    })
    expect(await screen.findByText('Password has been reset')).toBeInTheDocument()
  })

  it('disables submission and warns when the token is missing', () => {
    render(
      <MemoryRouter initialEntries={['/reset-password']}>
        <ResetPasswordPage />
      </MemoryRouter>,
    )

    expect(screen.getByRole('alert')).toHaveTextContent('Missing reset token.')
    expect(screen.getByRole('button', { name: 'Reset password' })).toBeDisabled()
  })
})
