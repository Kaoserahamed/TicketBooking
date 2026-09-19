import { useEffect, useState } from 'react'
import {
  adminApi,
  type AdminRole,
  type AdminUserStatus,
  type AdminListUsersParams,
} from '../api/admin'
import type { User } from '../api/auth'
import { extractErrorMessage } from '../api/client'
import AdminNav from '../components/AdminNav'

const ROLES: AdminRole[] = ['USER', 'ADMIN', 'EVENT_MANAGER', 'VENUE_MANAGER', 'SUPPORT']
const STATUSES: AdminUserStatus[] = ['ACTIVE', 'INACTIVE', 'SUSPENDED', 'BLOCKED']

// GET /api/v1/admin/users?role=&status=&limit= (ADMIN only) — no offset paging.
export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [total, setTotal] = useState(0)
  const [role, setRole] = useState('')
  const [status, setStatus] = useState('')
  const [applied, setApplied] = useState<{ role?: AdminRole; status?: AdminUserStatus }>({})
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setIsLoading(true)
      setError(null)
      try {
        const params: AdminListUsersParams = { limit: 100 }
        if (applied.role) params.role = applied.role
        if (applied.status) params.status = applied.status
        const data = await adminApi.listUsers(params)
        if (!cancelled) {
          setUsers(data.users)
          setTotal(data.total)
        }
      } catch (err) {
        if (!cancelled) setError(extractErrorMessage(err, 'Failed to load users'))
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [applied])

  const inputClass =
    'px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500'

  return (
    <div>
      <AdminNav />
      <h1 className="text-2xl font-bold text-gray-900 mb-4">Users</h1>

      <form
        className="flex flex-wrap items-end gap-3 mb-6"
        onSubmit={(e) => {
          e.preventDefault()
          setApplied({
            role: (role || undefined) as AdminRole | undefined,
            status: (status || undefined) as AdminUserStatus | undefined,
          })
        }}
      >
        <label className="text-sm text-gray-700">
          Role
          <select
            aria-label="Filter by role"
            className={`${inputClass} block mt-1`}
            value={role}
            onChange={(e) => setRole(e.target.value)}
          >
            <option value="">All roles</option>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm text-gray-700">
          Status
          <select
            aria-label="Filter by status"
            className={`${inputClass} block mt-1`}
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">All statuses</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          className="px-4 py-2 text-sm font-medium bg-primary-600 text-white rounded-md hover:bg-primary-700"
        >
          Apply filters
        </button>
      </form>

      {error && (
        <div
          role="alert"
          className="mb-4 px-4 py-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md"
        >
          {error}
        </div>
      )}
      {isLoading ? (
        <p className="text-gray-500">Loading users…</p>
      ) : users.length === 0 ? (
        <p className="text-gray-500">No users match these filters.</p>
      ) : (
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Name</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Email</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Role</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Status</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Verified</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {users.map((u) => (
                <tr key={u.id}>
                  <td className="px-4 py-3 text-gray-900">{u.name}</td>
                  <td className="px-4 py-3 text-gray-600">{u.email}</td>
                  <td className="px-4 py-3 text-gray-600">{u.role}</td>
                  <td className="px-4 py-3 text-gray-600">{u.status}</td>
                  <td className="px-4 py-3 text-gray-600">{u.emailVerified ? 'Yes' : 'No'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {!isLoading && !error && (
        <p className="mt-3 text-sm text-gray-500">
          Page 1 of 1 ({total} user{total === 1 ? '' : 's'})
        </p>
      )}
    </div>
  )
}
