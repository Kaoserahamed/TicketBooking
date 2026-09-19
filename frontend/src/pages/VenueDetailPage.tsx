import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { venueApi } from '../api/venues'
import type { SeatType, VenueSeat } from '../api/venues'
import { extractErrorMessage } from '../api/client'

const SEAT_TYPES: Array<SeatType | ''> = ['', 'REGULAR', 'VIP', 'PREMIUM', 'BALCONY', 'BOX']

export default function VenueDetailPage() {
  const { id } = useParams()
  const venueId = Number(id)

  const [seatType, setSeatType] = useState<SeatType | ''>('')
  const [seats, setSeats] = useState<VenueSeat[]>([])
  const [seatTotal, setSeatTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // The venue itself is fetched once; the seat list refetches on filter change.
  const [venue, setVenue] = useState<Awaited<ReturnType<typeof venueApi.getVenue>> | null>(null)

  useEffect(() => {
    if (!Number.isInteger(venueId) || venueId <= 0) {
      setError('Invalid venue id')
      setIsLoading(false)
      return
    }
    let cancelled = false
    venueApi
      .getVenue(venueId)
      .then((v) => {
        if (cancelled) return
        setVenue(v)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setError(extractErrorMessage(err, 'Could not load venue'))
        setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [venueId])

  useEffect(() => {
    if (!Number.isInteger(venueId) || venueId <= 0) return
    let cancelled = false
    setIsLoading(true)
    venueApi
      .listSeats(venueId, { seatType: seatType || undefined, limit: 100 })
      .then((result) => {
        if (cancelled) return
        setSeats(result.seats)
        setSeatTotal(result.total)
        setError(null)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setError(extractErrorMessage(err, 'Could not load seats'))
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [venueId, seatType])

  const seatsByRow = useMemo(() => {
    const grouped = new Map<string, VenueSeat[]>()
    for (const seat of seats) {
      const list = grouped.get(seat.row) ?? []
      list.push(seat)
      grouped.set(seat.row, list)
    }
    return Array.from(grouped.entries())
  }, [seats])

  if (!Number.isInteger(venueId) || venueId <= 0) {
    return (
      <div>
        <p role="alert" className="text-sm text-red-600">
          Invalid venue id
        </p>
        <Link to="/venues" className="mt-4 inline-block text-sm text-primary-600 hover:underline">
          ← Back to venues
        </Link>
      </div>
    )
  }

  return (
    <div>
      <Link to="/venues" className="text-sm text-primary-600 hover:underline">
        ← Back to venues
      </Link>

      {error && (
        <p role="alert" className="mt-6 text-sm text-red-600">
          {error}
        </p>
      )}

      {venue && !error && (
        <div className="mt-4 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-bold text-gray-900">{venue.name}</h1>
          <p className="mt-1 text-sm text-gray-600">
            {venue.address ?? '—'}, {venue.city ?? '—'} · capacity {venue.capacity}
          </p>
          {venue.seats && (
            <p className="mt-2 text-sm text-gray-600">
              Seats: {venue.seats.total} total
              {Object.entries(venue.seats.byType).map(([type, count]) =>
                count > 0 ? ` · ${count} ${type}` : '',
              )}
            </p>
          )}
        </div>
      )}

      {venue && (
        <div className="mt-6">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-lg font-semibold text-gray-900">Seat layout</h2>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              Filter seats by type
              <select
                aria-label="Filter seats by type"
                value={seatType}
                onChange={(e) => setSeatType(e.target.value as SeatType | '')}
                className="rounded-md border border-gray-300 px-2 py-1 text-sm"
              >
                {SEAT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t === '' ? 'All types' : t}
                  </option>
                ))}
              </select>
            </label>
            <span className="text-sm text-gray-600">
              {seatTotal} seat{seatTotal === 1 ? '' : 's'}
            </span>
          </div>

          {isLoading && <p className="mt-4 text-sm text-gray-600">Loading seats…</p>}

          {!isLoading && seats.length === 0 && (
            <p className="mt-4 text-sm text-gray-600">No seats match this filter.</p>
          )}

          <div className="mt-4 space-y-3">
            {seatsByRow.map(([row, rowSeats]) => (
              <div key={row} className="flex flex-wrap items-center gap-2">
                <span className="w-16 text-sm font-semibold text-gray-700">Row {row}</span>
                {rowSeats.map((seat) => (
                  <span
                    key={seat.id}
                    title={`${seat.label} · ${seat.seatType}`}
                    className="rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700"
                  >
                    {seat.label}
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
