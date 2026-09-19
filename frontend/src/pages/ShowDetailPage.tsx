import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { showApi } from '../api/shows'
import type { Availability, ShowDetail, ShowSeat } from '../api/shows'
import { extractErrorMessage } from '../api/client'
import { useAuthStore } from '../stores/auth'

function formatDateTime(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString()
}

type SeatFilter = 'ALL' | 'AVAILABLE' | 'HELD' | 'BOOKED' | 'BLOCKED'

export default function ShowDetailPage() {
  const { id } = useParams<{ id: string }>()
  const showId = Number(id)
  const { token } = useAuthStore()
  const [show, setShow] = useState<ShowDetail | null>(null)
  const [seats, setSeats] = useState<ShowSeat[]>([])
  const [totalSeats, setTotalSeats] = useState(0)
  const [availability, setAvailability] = useState<Availability | null>(null)
  const [filter, setFilter] = useState<SeatFilter>('ALL')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)


  useEffect(() => {
    if (!Number.isInteger(showId) || showId <= 0) {
      setIsLoading(false)
      setError('Invalid show id.')
      return
    }
    let cancelled = false
    setIsLoading(true)
    setError(null)
    const load = async () => {
      try {
        const [loadedShow, seatMap, loadedAvailability] = await Promise.all([
          showApi.getShow(showId),
          showApi.getSeatMap(showId),
          showApi.getAvailability(showId),
        ])
        if (cancelled) return
        setShow(loadedShow)
        setSeats(seatMap.seats)
        setTotalSeats(seatMap.total)
        setAvailability(loadedAvailability)
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
  }, [showId])

  const grouped = useMemo(() => {
    const rows = new Map<string, ShowSeat[]>()
    for (const seat of seats) {
      if (filter !== 'ALL' && seat.status !== filter) continue
      const list = rows.get(seat.row) ?? []
      list.push(seat)
      rows.set(seat.row, list)
    }
    return [...rows.entries()].sort(([a], [b]) => a.localeCompare(b))
  }, [seats, filter])

  if (isLoading) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Show detail</h1>
        <p className="mt-2 text-sm text-gray-600">Loading show…</p>
      </div>
    )
  }

  if (error || !show) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Show detail</h1>
        <p role="alert" className="mt-2 text-sm text-red-600">
          {error ?? 'Show not found.'}
        </p>
        <p className="mt-4 text-sm">
          <Link to="/events" className="text-primary-600 hover:underline">
            Back to events
          </Link>
        </p>
      </div>
    )
  }

  const counts = availability ?? show.seats

  return (
    <div className="max-w-4xl">
      <p className="text-sm">
        <Link to={`/events/${show.eventId}`} className="text-primary-600 hover:underline">
          Back to event
        </Link>
      </p>
      <h1 className="mt-2 text-3xl font-bold text-gray-900">{show.event.name}</h1>
      <p className="mt-1 text-sm text-gray-600">
        {show.venue.name}
        {show.venue.city ? ` · ${show.venue.city}` : ''} · {formatDateTime(show.startTime)}
      </p>

      <dl className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
        {(
          [
            ['Total', counts.total],
            ['Available', counts.available],
            ['Held', counts.held],
            ['Booked', counts.booked],
            ['Blocked', counts.blocked],
          ] as const
        ).map(([label, value]) => (
          <div key={label} className="rounded-md border border-gray-200 bg-white p-2 text-center">
            <dt className="text-xs uppercase tracking-wide text-gray-500">{label}</dt>
            <dd className="text-lg font-semibold text-gray-900">{value}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-gray-900">Seat map ({totalSeats})</h2>
        <label className="text-sm text-gray-600">
          Filter{' '}
          <select
            aria-label="Filter seats by status"
            value={filter}
            onChange={(e) => setFilter(e.target.value as SeatFilter)}
            className="rounded-md border border-gray-300 px-2 py-1"
          >
            <option value="ALL">All</option>
            <option value="AVAILABLE">Available</option>
            <option value="HELD">Held</option>
            <option value="BOOKED">Booked</option>
            <option value="BLOCKED">Blocked</option>
          </select>
        </label>
      </div>

      {grouped.length === 0 ? (
        <p className="mt-2 text-sm text-gray-600">No seats match this filter.</p>
      ) : (
        <div className="mt-4 space-y-4">
          {grouped.map(([row, rowSeats]) => (
            <div key={row}>
              <h3 className="text-sm font-semibold text-gray-700">Row {row}</h3>
              <ul className="mt-1 flex flex-wrap gap-1">
                {rowSeats.map((seat) => (
                  <li
                    key={seat.showSeatId}
                    title={`${seat.label} · ${seat.seatType} · ${seat.status}`}
                    className={`rounded border px-2 py-1 text-xs font-medium ${
                      seat.status === 'AVAILABLE'
                        ? 'border-green-300 bg-green-50 text-green-800'
                        : seat.status === 'HELD'
                          ? 'border-yellow-300 bg-yellow-50 text-yellow-800'
                          : seat.status === 'BOOKED'
                            ? 'border-gray-300 bg-gray-100 text-gray-500'
                            : 'border-red-300 bg-red-50 text-red-700'
                    }`}
                  >
                    {seat.label}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      <div className="mt-6">
        {token ? (
          <Link
            to={`/book/${show.id}`}
            className="inline-block rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
          >
            Book this show
          </Link>
        ) : (
          <p className="text-sm text-gray-600">
            <Link to="/login" className="text-primary-600 hover:underline">
              Sign in
            </Link>{' '}
            to book seats for this show.
          </p>
        )}
      </div>
    </div>
  )
}
