import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { showApi } from '../api/shows'
import type { ShowDetail, ShowSeat } from '../api/shows'
import { bookingApi, newIdempotencyKey } from '../api/bookings'
import type { Booking } from '../api/bookings'
import { extractErrorMessage } from '../api/client'

function formatDateTime(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString()
}

function formatMoney(value: string | number): string {
  return `$${Number(value).toFixed(2)}`
}

export default function BookShowPage() {
  const { showId } = useParams<{ showId: string }>()
  const id = Number(showId)
  const [show, setShow] = useState<ShowDetail | null>(null)
  const [seats, setSeats] = useState<ShowSeat[]>([])
  const [selected, setSelected] = useState<number[]>([])
  const [booking, setBooking] = useState<Booking | null>(null)
  const [replayed, setReplayed] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isHolding, setIsHolding] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!Number.isInteger(id) || id <= 0) {
      setIsLoading(false)
      setError('Invalid show id.')
      return
    }
    let cancelled = false
    setIsLoading(true)
    setError(null)
    const load = async () => {
      try {
        const [loadedShow, seatMap] = await Promise.all([
          showApi.getShow(id),
          showApi.getSeatMap(id),
        ])
        if (cancelled) return
        setShow(loadedShow)
        setSeats(seatMap.seats)
      } catch (err: unknown) {
        if (cancelled) return
        setError(extractErrorMessage(err, 'Could not load show'))
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [id])

  const grouped = useMemo(() => {
    const rows = new Map<string, ShowSeat[]>()
    for (const seat of seats) {
      const list = rows.get(seat.row) ?? []
      list.push(seat)
      rows.set(seat.row, list)
    }
    return [...rows.entries()].sort(([a], [b]) => a.localeCompare(b))
  }, [seats])

  const selectedTotal = useMemo(
    () =>
      seats.filter((s) => selected.includes(s.seatId)).reduce((sum, s) => sum + Number(s.price), 0),
    [seats, selected]
  )

  function toggleSeat(seat: ShowSeat) {
    if (seat.status !== 'AVAILABLE') return
    setSelected((prev) =>
      prev.includes(seat.seatId) ? prev.filter((s) => s !== seat.seatId) : [...prev, seat.seatId]
    )
  }

  async function onHold() {
    if (selected.length === 0 || isHolding) return
    setIsHolding(true)
    setError(null)
    const seatIds = [...selected]
    try {
      const result = await bookingApi.holdSeats({
        showId: id,
        seatIds,
        idempotencyKey: newIdempotencyKey(),
      })
      setBooking(result.booking)
      setReplayed(result.idempotentReplay)
      setSelected([])
      setIsHolding(false)
      void showApi.getSeatMap(id).then((seatMap) => setSeats(seatMap.seats))
    } catch (err: unknown) {
      setError(extractErrorMessage(err, 'Could not hold seats'))
      setIsHolding(false)
    }
  }

  if (isLoading) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Book show</h1>
        <p className="mt-2 text-sm text-gray-600">Loading show…</p>
      </div>
    )
  }

  if (error && !show) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Book show</h1>
        <p role="alert" className="mt-2 text-sm text-red-600">
          {error}
        </p>
      </div>
    )
  }

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold text-gray-900">Book show</h1>
      {show && (
        <p className="mt-1 text-sm text-gray-600">
          {show.event.name} · {show.venue.name} · {formatDateTime(show.startTime)}
        </p>
      )}
      <p className="mt-2 text-sm text-gray-600">
        Select up to 20 available seats. Holds last 10 minutes.
      </p>

      {error && (
        <p role="alert" className="mt-3 text-sm text-red-600">
          {error}
        </p>
      )}

      {booking && (
        <div className="mt-4 rounded-md border border-green-300 bg-green-50 p-3">
          <p className="text-sm font-semibold text-green-800">
            {replayed ? 'Duplicate request — showing your existing hold.' : 'Seats held!'}
          </p>
          <p className="mt-1 text-sm text-green-800">
            Reference {booking.bookingReference} · {booking.items.length} seat(s) · $
            {Number(booking.totalAmount).toFixed(2)}
          </p>
          <p className="mt-1 text-sm">
            <Link to="/bookings" className="text-primary-700 hover:underline">
              View my bookings
            </Link>
          </p>
        </div>
      )}

      <div className="mt-4 space-y-4">
        {grouped.map(([row, rowSeats]) => (
          <div key={row}>
            <h2 className="text-sm font-semibold text-gray-700">Row {row}</h2>
            <ul className="mt-1 flex flex-wrap gap-1">
              {rowSeats.map((seat) => {
                const isSelected = selected.includes(seat.seatId)
                const disabled = seat.status !== 'AVAILABLE'
                return (
                  <li key={seat.showSeatId}>
                    <button
                      type="button"
                      disabled={disabled}
                      aria-pressed={isSelected}
                      aria-label={`Seat ${seat.label}, ${seat.status.toLowerCase()}`}
                      onClick={() => toggleSeat(seat)}
                      className={`rounded border px-2 py-1 text-xs font-medium ${
                        isSelected
                          ? 'border-primary-600 bg-primary-600 text-white'
                          : seat.status === 'AVAILABLE'
                            ? 'border-green-300 bg-green-50 text-green-800'
                            : 'border-gray-300 bg-gray-100 text-gray-400'
                      }`}
                    >
                      {seat.label}
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </div>

      <div className="mt-6 flex items-center gap-4">
        <button
          type="button"
          disabled={selected.length === 0 || isHolding}
          onClick={() => void onHold()}
          className="rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {isHolding
            ? 'Holding…'
            : `Hold ${selected.length} seat(s) · ${formatMoney(selectedTotal)}`}
        </button>
        {selected.length > 0 && (
          <button
            type="button"
            onClick={() => setSelected([])}
            className="text-sm text-gray-600 hover:underline"
          >
            Clear selection
          </button>
        )}
      </div>
    </div>
  )
}
