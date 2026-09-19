import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../stores/auth'

export default function RegisterPage() {
  const navigate = useNavigate()
  const { token, isLoading, error, register, clearError } = useAuthStore()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')

  useEffect(() => {
    clearError()
    return clearError
  }, [clearError])

  useEffect(() => {
    if (token) navigate('/', { replace: true })
  }, [token, navigate])

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    try {
      await register({
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim() || undefined,
        password,
      })
    } catch {
      // error is surfaced via the store
    }
  }

  return (
    <div className="max-w-md mx-auto">
      <h1 className="text-2xl font-bold text-gray-900">Register</h1>
      <p className="mt-1 text-sm text-gray-600">
        Already have an account?{' '}
        <Link to="/login" className="text-primary-600 hover:underline">
          Sign in
        </Link>
      </p>
      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <div>
          <label htmlFor="register-name" className="block text-sm font-medium text-gray-700">
            Full name
          </label>
          <input
            id="register-name"
            type="text"
            required
            minLength={2}
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary-500 focus:outline-none"
          />
        </div>
        <div>
          <label htmlFor="register-email" className="block text-sm font-medium text-gray-700">
            Email
          </label>
          <input
            id="register-email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary-500 focus:outline-none"
          />
        </div>
        <div>
          <label htmlFor="register-phone" className="block text-sm font-medium text-gray-700">
            Phone (optional)
          </label>
          <input
            id="register-phone"
            type="tel"
            autoComplete="tel"
            placeholder="+15551234567"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary-500 focus:outline-none"
          />
        </div>
        <div>
          <label htmlFor="register-password" className="block text-sm font-medium text-gray-700">
            Password
          </label>
          <input
            id="register-password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary-500 focus:outline-none"
          />
          <p className="mt-1 text-xs text-gray-500">
            At least 8 characters with a letter and a number.
          </p>
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
          {isLoading ? 'Creating account…' : 'Register'}
        </button>
      </form>
    </div>
  )
}
