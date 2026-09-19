import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { adminApi } from '../api/admin'
import { venueApi, type SeatType, type Venue, type VenueSeat } from '../api/venues'
import { extractErrorMessage } from '../api/client'
import AdminNav from '../components/AdminNav'

const SEAT_TYPES: SeatType[] = ['REGULAR', 'VIP', 'PREMIUM', 'BALCONY', 'BOX']

// POST / PUT / DELETE /api/v1/admin/venues/:id/seats (ADMIN, VENUE_MANAGER)
// Reads the venue + seat layout via the public venue endpoints.
export default function AdminVenueSeatsPage() {
  const { id } = useParams()
  const venueId = Number(id)
  const [venue, setVenue] = useState<Venue | null>(null)
  const [seats, setSeats] = useState<VenueSeat[]>([])
  const [rowNumber, setRowNumber] = useState('')
  const [seatNumber, setSeatNumber] = useState('')
  const [seatType, setSeatType] = useState<SeatType>('REGULAR')
  const [isSaving, setIsSaving] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const invalid = !Number.isInteger(venueId) || venueId <= 0

  useEffect(() => {
    if (invalid) {
      setError('Invalid venue id')
      setIsLoading(false)
      return
    }
    let cancelled = false
    async function load() {
      setIsLoading(true)
      setError(null)
      try {
        const [v, s] = await Promise.all([
          venueApi.getVenue(venueId),
          venueApi.listSeats(venueId, { limit: 500 }),
        ])
        if (!cancelled) {
          setVenue(v)
          setSeats(s.seats)
        }
      } catch (err) {
        if (!cancelled) setError(extractErrorMessage(err, 'Failed to load venue seats'))
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [venueId, invalid])

  async function reloadSeats() {
    const s = await venueApi.listSeats(venueId, { limit: 500 })
    setSeats(s.seats)
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setNotice(null)
    setIsSaving(true)
    try {
      const seat = await adminApi.createSeat(venueId, { rowNumber, seatNumber, seatType })
      setNotice(`Seat ${seat.label} added`)
      setSeatNumber('')
      await reloadSeats()
    } catch (err) {
      setNotice(extractErrorMessage(err, 'Failed to add seat'))
    } finally {
      setIsSaving(false)
    }
  }

  async function handleTypeChange(seatId: number, nextType: SeatType) {
    setNotice(null)
    try {
      await adminApi.updateSeat(venueId, seatId, nextType)
      setSeats((prev) => prev.map((s) => (s.id === seatId ? { ...s, seatType: nextType } : s)))
      setNotice(`Seat #${seatId} type set to ${nextType}`)
    } catch (err) {
      setNotice(extractErrorMessage(err, 'Failed to update seat'))
    }
  }

  async function handleDelete(seatId: number) {
    setNotice(null)
    try {
      const message = await adminApi.deleteSeat(venueId, seatId)
      setSeats((prev) => prev.filter((s) => s.id !== seatId))
      setNotice(message || 'Seat deleted')
    } catch (err) {
      setNotice(extractErrorMessage(err, 'Failed to delete seat'))
    }
  }

  const inputClass =
    'px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500'
  if (invalid) {
    return (
      <div>
        <AdminNav />
        <div role="alert" className="px-4 py-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md">
          Invalid venue id
        </div>
        <Link to="/admin/venues" className="text-sm text-primary-700 hover:underline">
          ← Back to venues
        </Link>
      </div>
    )
  }

  return (
    <div>
      <AdminNav />
      <Link to="/admin/venues" className="text-sm text-primary-700 hover:underline">
        ← Back to venues
      </Link>
      <h1 className="text-2xl font-bold text-gray-900 mt-2 mb-1">Seat layout</h1>
      <p className="text-sm text-gray-500 mb-6">
        {venue ? `${venue.name} — ${venue.city ?? ''} (capacity ${venue.capacity})` : `Venue #${venueId}`}
      </p>

      <div className="bg-white shadow rounded-lg p-6 mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Add seat</h2>
        <form className="flex flex-wrap items-end gap-3" onSubmit={handleAdd}>
          <label className="text-sm text-gray-700">
            Row
            <input aria-label="Row number" className={`${inputClass} block mt-1`} value={rowNumber} onChange={(e) => setRowNumber(e.target.value)} required maxLength={10} />
          </label>
          <label className="text-sm text-gray-700">
            Seat number
            <input aria-label="Seat number" className={`${inputClass} block mt-1`} value={seatNumber} onChange={(e) => setSeatNumber(e.target.value)} required maxLength={10} />
          </label>
          <label className="text-sm text-gray-700">
            Type
            <select aria-label="Seat type" className={`${inputClass} block mt-1`} value={seatType} onChange={(e) => setSeatType(e.target.value as SeatType)}>
              {SEAT_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </label>
          <button type="submit" disabled={isSaving} className="px-4 py-2 text-sm font-medium bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50">
            Add seat
          </button>
        </form>
        {notice && (
          <p role="status" className="mt-4 text-sm text-gray-700">{notice}</p>
        )}
      </div>

      {error && (
        <div role="alert" className="mb-4 px-4 py-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md">
          {error}
        </div>
      )}
      {isLoading ? (
        <p className="text-gray-500">Loading seats…</p>
      ) : seats.length === 0 ? (
        <p className="text-gray-500">No seats yet — add the first one above.</p>
      ) : (
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Seat</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Row</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Number</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Type</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {seats.map((s) => (
                <tr key={s.id}>
                  <td className="px-4 py-3 text-gray-900 font-medium">{s.label}</td>
                  <td className="px-4 py-3 text-gray-600">{s.row}</td>
                  <td className="px-4 py-3 text-gray-600">{s.number}</td>
                  <td className="px-4 py-3">
                    <select
                      aria-label={`Seat type for ${s.label}`}
                      className={inputClass}
                      value={s.seatType}
                      onChange={(e) => handleTypeChange(s.id, e.target.value as SeatType)}
                    >
                      {SEAT_TYPES.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      className="text-sm font-medium text-red-700 hover:underline"
                      onClick={() => handleDelete(s.id)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}


