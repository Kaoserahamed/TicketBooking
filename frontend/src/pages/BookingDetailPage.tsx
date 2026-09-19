import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { bookingApi } from '../api/bookings'
import type { Booking } from '../api/bookings'
import { extractErrorMessage } from '../api/client'

function formatDateTime(value: string | null): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString()
}

// GET /bookings/{id} detail view with links to pay (pending) or view the
// issued ticket (confirmed, §4.7).
export default function BookingDetailPage() {
  const { id } = useParams<{ id: string }>()
  const bookingId = Number(id)
  const [booking, setBooking] = useState<Booking | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const invalid = !Number.isInteger(bookingId) || bookingId <= 0

  useEffect(() => {
    if (invalid) {
      setError('Invalid booking id')
      setIsLoading(false)
      return
    }
    let cancelled = false
    async function load() {
      setIsLoading(true)
      setError(null)
      try {
        const detail = await bookingApi.getBooking(bookingId)
        if (!cancelled) setBooking(detail.booking)
      } catch (err) {
        if (!cancelled) setError(extractErrorMessage(err, 'Could not load booking'))
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [bookingId, invalid])

  if (invalid) {
    return (
      <div className="max-w-2xl">
        <div role="alert" className="text-sm text-red-600">
          Invalid booking id
        </div>
        <Link to="/bookings" className="text-sm text-primary-700 hover:underline">
          ← Back to my bookings
        </Link>
      </div>
    )
  }

  const payable = booking && (booking.status === 'PENDING' || booking.status === 'HOLDING')

  return (
    <div className="max-w-2xl">
      <Link to="/bookings" className="text-sm text-primary-700 hover:underline">
        ← Back to my bookings
      </Link>
      <h1 className="text-2xl font-bold text-gray-900 mt-2 mb-4">
        Booking {booking ? booking.bookingReference : ''}
      </h1>

      {error && (
        <p role="alert" className="mb-4 text-sm text-red-600">
          {error}
        </p>
      )}
      {isLoading ? (
        <p className="text-sm text-gray-600">Loading booking…</p>
      ) : booking ? (
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <p className="text-sm text-gray-600">
            Status: <span className="font-medium text-gray-900">{booking.status}</span>
          </p>
          <p className="mt-1 text-sm text-gray-600">
            {booking.show.event.name} — {booking.show.venue.name}, {booking.show.venue.city}
          </p>
          <p className="mt-1 text-sm text-gray-600">
            Show time: {formatDateTime(booking.show.startTime)}
          </p>
          <p className="mt-1 text-sm text-gray-600">
            Seats: {booking.items.map((i) => i.seat.label ?? `#${i.seat.id}`).join(', ')}
          </p>
          <p className="mt-1 text-sm text-gray-600">
            Total: {booking.currency} {booking.totalAmount.toFixed(2)}
            {booking.discount > 0
              ? ` (discount ${booking.currency} ${booking.discount.toFixed(2)})`
              : ''}
          </p>
          <p className="mt-1 text-sm text-gray-600">Expires: {formatDateTime(booking.expiresAt)}</p>

          <div className="mt-6 flex gap-4">
            {payable && (
              <Link
                to={`/bookings/${booking.id}/pay`}
                className="rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
              >
                Pay now
              </Link>
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
        </div>
      ) : null}
    </div>
  )
}
