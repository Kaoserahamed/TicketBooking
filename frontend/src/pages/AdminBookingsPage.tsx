import { useEffect, useState } from 'react'
import { adminApi, type AdminListBookingsParams } from '../api/admin'
import type { Booking, BookingStatus } from '../api/bookings'
import { extractErrorMessage } from '../api/client'
import AdminNav from '../components/AdminNav'

const STATUSES: BookingStatus[] = ['PENDING', 'HOLDING', 'CONFIRMED', 'CANCELLED', 'EXPIRED']
const PAGE_SIZE = 10

// GET /api/v1/admin/bookings?status=&limit=&offset= (ADMIN only)
// Admin sees every booking; toBooking always includes the user here because
// booking.repository.listAll joins users.
export default function AdminBookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([])
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const [status, setStatus] = useState('')
  const [applied, setApplied] = useState<{ status?: BookingStatus }>({})
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setIsLoading(true)
      setError(null)
      try {
        const params: AdminListBookingsParams = { limit: PAGE_SIZE, offset }
        if (applied.status) params.status = applied.status
        const data = await adminApi.listBookings(params)
        if (!cancelled) {
          setBookings(data.bookings)
          setTotal(data.total)
        }
      } catch (err) {
        if (!cancelled) setError(extractErrorMessage(err, 'Failed to load bookings'))
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [applied, offset])

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1
  const inputClass =
    'px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500'

  return (
    <div>
      <AdminNav />
      <h1 className="text-2xl font-bold text-gray-900 mb-4">Bookings</h1>

      <form
        className="flex flex-wrap items-end gap-3 mb-6"
        onSubmit={(e) => {
          e.preventDefault()
          setOffset(0)
          setApplied({ status: (status || undefined) as BookingStatus | undefined })
        }}
      >
        <label className="text-sm text-gray-700">
          Status
          <select
            aria-label="Filter by booking status"
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
        <p className="text-gray-500">Loading bookings…</p>
      ) : bookings.length === 0 ? (
        <p className="text-gray-500">No bookings match these filters.</p>
      ) : (
        <div className="bg-white shadow rounded-lg overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Reference</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Customer</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Event</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Venue</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Show time</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Total</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {bookings.map((b) => (
                <tr key={b.id}>
                  <td className="px-4 py-3 text-gray-900 font-medium">{b.bookingReference}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {b.user ? `${b.user.name} (${b.user.email})` : `User #${b.userId}`}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{b.show.event.name}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {b.show.venue.name}, {b.show.venue.city}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {new Date(b.show.startTime).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {b.currency} {b.totalAmount.toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{b.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {!isLoading && !error && (
        <div className="mt-3 flex items-center gap-4 text-sm text-gray-500">
          <button
            type="button"
            className="px-3 py-1 border border-gray-300 rounded-md disabled:opacity-40"
            disabled={offset === 0}
            onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
          >
            Previous
          </button>
          <span>
            Page {currentPage} of {totalPages} ({total} bookings)
          </span>
          <button
            type="button"
            className="px-3 py-1 border border-gray-300 rounded-md disabled:opacity-40"
            disabled={offset + PAGE_SIZE >= total}
            onClick={() => setOffset(offset + PAGE_SIZE)}
          >
            Next
          </button>
        </div>
      )}
    </div>
  )
}
