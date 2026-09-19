import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { authApi } from '../api/auth'
import { extractErrorMessage } from '../api/client'

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const [newPassword, setNewPassword] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const token = searchParams.get('token') ?? ''

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    setMessage(null)
    setError(null)
    try {
      const result = await authApi.resetPassword(token, newPassword)
      setMessage(result)
      setNewPassword('')
    } catch (err) {
      setError(extractErrorMessage(err, 'Reset failed'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-md mx-auto">
      <h1 className="text-2xl font-bold text-gray-900">Reset password</h1>
      {!token && (
        <p role="alert" className="mt-2 text-sm text-red-600">
          Missing reset token.
        </p>
      )}
      <form onSubmit={(e) => void onSubmit(e)} className="mt-6 space-y-4">
        <div>
          <label htmlFor="reset-password" className="block text-sm font-medium text-gray-700">
            New password
          </label>
          <input
            id="reset-password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
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
          disabled={saving || !token}
          className="w-full rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Reset password'}
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
