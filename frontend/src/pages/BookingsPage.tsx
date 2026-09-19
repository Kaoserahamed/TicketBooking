import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { bookingApi } from '../api/bookings'
import type { Booking, BookingStatus } from '../api/bookings'
import { extractErrorMessage } from '../api/client'

const PAGE_SIZE = 10

function formatDateTime(value: string | null): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString()
}

export default function BookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([])
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const [status, setStatus] = useState<'' | BookingStatus>('')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [cancellingId, setCancellingId] = useState<number | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const load = async (nextOffset: number, nextStatus: '' | BookingStatus) => {
    setIsLoading(true)
    setError(null)
    try {
      const result = await bookingApi.listMyBookings({
        status: nextStatus || undefined,
        limit: PAGE_SIZE,
        offset: nextOffset,
      })
      setBookings(result.bookings)
      setTotal(result.total)
    } catch (err: unknown) {
      setError(extractErrorMessage(err, 'Could not load bookings'))
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void load(0, '')
  }, [])

  function onStatusChange(next: '' | BookingStatus) {
    setStatus(next)
    setOffset(0)
    void load(0, next)
  }

  function onPage(nextOffset: number) {
    setOffset(nextOffset)
    void load(nextOffset, status)
  }

  async function onCancel(booking: Booking) {
    setCancellingId(booking.id)
    setNotice(null)
    setError(null)
    try {
      const result = await bookingApi.cancelBooking(booking.id)
      setNotice(`${result.message} (${result.released} seat(s) released).`)
      await load(offset, status)
    } catch (err: unknown) {
      setError(extractErrorMessage(err, 'Could not cancel booking'))
    } finally {
      setCancellingId(null)
    }
  }

  const page = Math.floor(offset / PAGE_SIZE) + 1
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold text-gray-900">My bookings</h1>

      <div className="mt-4">
        <label className="text-sm text-gray-600">
          Filter by status{' '}
          <select
            aria-label="Filter bookings by status"
            value={status}
            onChange={(e) => onStatusChange(e.target.value as '' | BookingStatus)}
            className="rounded-md border border-gray-300 px-2 py-1"
          >
            <option value="">All</option>
            <option value="PENDING">Pending</option>
            <option value="HOLDING">Holding</option>
            <option value="CONFIRMED">Confirmed</option>
            <option value="CANCELLED">Cancelled</option>
            <option value="EXPIRED">Expired</option>
          </select>
        </label>
      </div>

      {isLoading && <p className="mt-4 text-sm text-gray-600">Loading bookings…</p>}
      {error && (
        <p role="alert" className="mt-4 text-sm text-red-600">
          {error}
        </p>
      )}
      {notice && <p className="mt-4 text-sm text-green-700">{notice}</p>}

      {!isLoading && !error && bookings.length === 0 && (
        <p className="mt-4 text-sm text-gray-600">No bookings found.</p>
      )}

      {!isLoading && bookings.length > 0 && (
        <>
          <ul className="mt-4 space-y-3">
            {bookings.map((booking) => (
              <li key={booking.id} className="rounded-lg border border-gray-200 bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-medium text-gray-900">
                      {booking.show.event.name} · {booking.bookingReference}{' '}
                      <Link
                        to={`/bookings/${booking.id}`}
                        className="text-sm font-normal text-primary-700 hover:underline"
                      >
                        Details
                      </Link>
                    </p>
                    <p className="text-sm text-gray-600">
                      {booking.show.venue.name} · {formatDateTime(booking.show.startTime)}
                    </p>
                    <p className="mt-1 text-sm text-gray-600">
                      {booking.status} · {booking.items.length} seat(s) · $
                      {Number(booking.totalAmount).toFixed(2)}
                    </p>
                  </div>
                  {(booking.status === 'PENDING' || booking.status === 'HOLDING') && (
                    <div className="flex items-center gap-3">
                      <Link
                        to={`/bookings/${booking.id}/pay`}
                        className="rounded-md bg-primary-600 px-3 py-1 text-sm font-medium text-white hover:bg-primary-700"
                      >
                        Pay now
                      </Link>
                      <button
                        type="button"
                        disabled={cancellingId === booking.id}
                        onClick={() => void onCancel(booking)}
                        className="rounded-md border border-red-300 px-3 py-1 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                      >
                        {cancellingId === booking.id ? 'Cancelling…' : 'Cancel booking'}
                      </button>
                    </div>
                  )}
                  {booking.status === 'CONFIRMED' && booking.ticketId && (
                    <Link
                      to={`/tickets/${booking.ticketId}`}
                      className="text-sm font-medium text-primary-700 hover:underline"
                    >
                      View ticket →
                    </Link>
                  )}
                </div>
              </li>
            ))}
          </ul>

          <div className="mt-6 flex items-center gap-4">
            <button
              type="button"
              disabled={offset === 0}
              onClick={() => onPage(Math.max(0, offset - PAGE_SIZE))}
              className="rounded-md border border-gray-300 px-3 py-1 text-sm disabled:opacity-50"
            >
              Previous
            </button>
            <span className="text-sm text-gray-600">
              Page {page} of {pageCount} ({total} bookings)
            </span>
            <button
              type="button"
              disabled={offset + PAGE_SIZE >= total}
              onClick={() => onPage(offset + PAGE_SIZE)}
              className="rounded-md border border-gray-300 px-3 py-1 text-sm disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </>
      )}
    </div>
  )
}
