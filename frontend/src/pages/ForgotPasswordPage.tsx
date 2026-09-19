import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { authApi } from '../api/auth'
import { extractErrorMessage } from '../api/client'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setSending(true)
    setMessage(null)
    setError(null)
    try {
      const result = await authApi.forgotPassword(email.trim())
      setMessage(result)
    } catch (err) {
      setError(extractErrorMessage(err, 'Request failed'))
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="max-w-md mx-auto">
      <h1 className="text-2xl font-bold text-gray-900">Forgot password</h1>
      <form onSubmit={(e) => void onSubmit(e)} className="mt-6 space-y-4">
        <div>
          <label htmlFor="forgot-email" className="block text-sm font-medium text-gray-700">
            Email
          </label>
          <input
            id="forgot-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
          />
        </div>
        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}
        {message && <p className="text-sm text-green-700">{message}</p>}
        <button
          type="submit"
          disabled={sending}
          className="w-full rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
        >
          {sending ? 'Sending…' : 'Send reset link'}
        </button>
      </form>
      <p className="mt-4 text-sm text-gray-600">
        <Link to="/login" className="text-primary-600 hover:underline">
          Back to login
        </Link>
      </p>
    </div>
  )
}
