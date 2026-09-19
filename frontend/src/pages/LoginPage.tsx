import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../stores/auth'

type LocationState = { from?: { pathname?: string } }

export default function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { token, isLoading, error, login, clearError } = useAuthStore()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  useEffect(() => {
    clearError()
    return clearError
  }, [clearError])

  useEffect(() => {
    if (token) {
      const redirectTo = (location.state as LocationState | null)?.from?.pathname ?? '/'
      navigate(redirectTo, { replace: true })
    }
  }, [token, navigate, location.state])

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    try {
      await login(email.trim(), password)
    } catch {
      // error is surfaced via the store
    }
  }

  return (
    <div className="max-w-md mx-auto">
      <h1 className="text-2xl font-bold text-gray-900">Login</h1>
      <p className="mt-1 text-sm text-gray-600">
        New here?{' '}
        <Link to="/register" className="text-primary-600 hover:underline">
          Create an account
        </Link>
      </p>
      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <div>
          <label htmlFor="login-email" className="block text-sm font-medium text-gray-700">
            Email
          </label>
          <input
            id="login-email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary-500 focus:outline-none"
          />
        </div>
        <div>
          <label htmlFor="login-password" className="block text-sm font-medium text-gray-700">
            Password
          </label>
          <input
            id="login-password"
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary-500 focus:outline-none"
          />
        </div>
        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={isLoading}
          className="w-full rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
        >
          {isLoading ? 'Signing in…' : 'Login'}
        </button>
        <p className="text-sm text-gray-600">
          <Link to="/forgot-password" className="text-primary-600 hover:underline">
            Forgot your password?
          </Link>
        </p>
      </form>
    </div>
  )
}
