import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useAuthStore } from '../stores/auth'
import { authApi } from '../api/auth'
import { extractErrorMessage } from '../api/client'

export default function ProfilePage() {
  const { user, isLoading, error, fetchUser, updateProfile } = useAuthStore()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [profileMessage, setProfileMessage] = useState<string | null>(null)
  const [verifyMessage, setVerifyMessage] = useState<string | null>(null)

  useEffect(() => {
    void fetchUser()
  }, [fetchUser])

  useEffect(() => {
    if (user) {
      setName(user.name)
      setEmail(user.email)
      setPhone(user.phone ?? '')
    }
  }, [user])

  async function onProfileSubmit(event: FormEvent) {
    event.preventDefault()
    setProfileMessage(null)
    try {
      const changes: { name?: string; email?: string; phone?: string | null } = {}
      if (name.trim() !== user?.name) changes.name = name.trim()
      if (email.trim() !== user?.email) changes.email = email.trim()
      const nextPhone = phone.trim() === '' ? null : phone.trim()
      if (nextPhone !== (user?.phone ?? null)) changes.phone = nextPhone
      if (Object.keys(changes).length === 0) {
        setProfileMessage('No changes to save.')
        return
      }
      await updateProfile(changes)
      setProfileMessage('Profile updated.')
    } catch {
      // error is surfaced via the store
    }
  }

  async function onResendVerification() {
    setVerifyMessage(null)
    try {
      const message = await authApi.resendVerification()
      setVerifyMessage(message)
    } catch (err) {
      setVerifyMessage(extractErrorMessage(err, 'Could not resend verification email'))
    }
  }

  if (!user && isLoading) {
    return <p>Loading profile…</p>
  }

  if (!user) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Profile</h1>
        {error && (
          <p role="alert" className="mt-2 text-sm text-red-600">
            {error}
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Profile</h1>
        <p className="mt-1 text-sm text-gray-600">
          {user.email} · {user.role}
          {user.emailVerified ? ' · verified' : ' · unverified'}
        </p>
        {!user.emailVerified && (
          <div className="mt-2">
            <button
              type="button"
              onClick={() => void onResendVerification()}
              className="text-sm text-primary-600 hover:underline"
            >
              Resend verification email
            </button>
            {verifyMessage && <p className="mt-1 text-sm text-gray-600">{verifyMessage}</p>}
          </div>
        )}
      </div>

      <form onSubmit={(e) => void onProfileSubmit(e)} className="space-y-4">
        <h2 className="text-lg font-semibold">Account details</h2>
        <div>
          <label htmlFor="profile-name" className="block text-sm font-medium text-gray-700">
            Full name
          </label>
          <input
            id="profile-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
          />
        </div>
        <div>
          <label htmlFor="profile-email" className="block text-sm font-medium text-gray-700">
            Email
          </label>
          <input
            id="profile-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
          />
        </div>
        <div>
          <label htmlFor="profile-phone" className="block text-sm font-medium text-gray-700">
            Phone
          </label>
          <input
            id="profile-phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
          />
        </div>
        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}
        {profileMessage && <p className="text-sm text-green-700">{profileMessage}</p>}
        <button
          type="submit"
          disabled={isLoading}
          className="rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
        >
          Save changes
        </button>
      </form>

      <PasswordForm />
    </div>
  )
}

function PasswordForm() {
  const { isLoading, changePassword } = useAuthStore()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [message, setMessage] = useState<string | null>(null)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setMessage(null)
    try {
      const result = await changePassword(currentPassword, newPassword)
      setMessage(`${result} Please sign in again.`)
      setCurrentPassword('')
      setNewPassword('')
    } catch {
      // error is surfaced via the store
    }
  }

  return (
    <form onSubmit={(e) => void onSubmit(e)} className="space-y-4">
      <h2 className="text-lg font-semibold">Change password</h2>
      <div>
        <label htmlFor="profile-current" className="block text-sm font-medium text-gray-700">
          Current password
        </label>
        <input
          id="profile-current"
          type="password"
          autoComplete="current-password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
        />
      </div>
      <div>
        <label htmlFor="profile-new" className="block text-sm font-medium text-gray-700">
          New password
        </label>
        <input
          id="profile-new"
          type="password"
          autoComplete="new-password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
        />
      </div>
      {message && <p className="text-sm text-green-700">{message}</p>}
      <button
        type="submit"
        disabled={isLoading}
        className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50"
      >
        Update password
      </button>
    </form>
  )
}
