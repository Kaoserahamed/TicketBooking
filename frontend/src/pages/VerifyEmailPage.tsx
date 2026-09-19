import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { authApi } from '../api/auth'
import { extractErrorMessage } from '../api/client'

export default function VerifyEmailPage() {
  const [searchParams] = useSearchParams()
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [message, setMessage] = useState<string | null>(null)
  const token = searchParams.get('token') ?? ''

  useEffect(() => {
    if (!token) {
      setStatus('error')
      setMessage('Missing verification token.')
      return
    }
    setStatus('loading')
    authApi
      .verifyEmail(token)
      .then(() => {
        setStatus('done')
        setMessage('Email address verified. You can now sign in.')
      })
      .catch((err: unknown) => {
        setStatus('error')
        setMessage(extractErrorMessage(err, 'Verification failed'))
      })
  }, [token])

  return (
    <div className="max-w-md mx-auto">
      <h1 className="text-2xl font-bold text-gray-900">Verify email</h1>
      {status === 'loading' && <p className="mt-2 text-sm text-gray-600">Verifying…</p>}
      {status === 'done' && <p className="mt-2 text-sm text-green-700">{message}</p>}
      {status === 'error' && (
        <p role="alert" className="mt-2 text-sm text-red-600">
          {message}
        </p>
      )}
      <p className="mt-4 text-sm text-gray-600">
        <Link to="/login" className="text-primary-600 hover:underline">
          Back to login
        </Link>
      </p>
    </div>
  )
}
