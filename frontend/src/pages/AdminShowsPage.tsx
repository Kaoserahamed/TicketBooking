import { useEffect, useState } from 'react'
import { adminApi, type CreateShowInput, type UpdateShowInput } from '../api/admin'
import { showApi, type ShowDetail, type ShowStatus } from '../api/shows'
import { eventApi, type Event } from '../api/events'
import { venueApi, type Venue } from '../api/venues'
import { extractErrorMessage } from '../api/client'
import AdminNav from '../components/AdminNav'

const SHOW_STATUSES: ShowStatus[] = ['SCHEDULED', 'ONGOING', 'COMPLETED', 'CANCELLED']
const PAGE_SIZE = 10

/** Convert a datetime-local value to the backend format: 2026-01-01 10:00:00. */
function toBackendDateTime(local: string): string {
  return local.replace('T', ' ') + ':00'
}

/** Backend '2026-01-01 10:00:00' → datetime-local '2026-01-01T10:00'. */
function toLocalInput(value: string): string {
  return value.replace(' ', 'T').slice(0, 16)
}

interface ShowForm {
  eventId: string
  venueId: string
  startTime: string
  endTime: string
  status: ShowStatus
  provisionInventory: boolean
  defaultPrice: string
}

const EMPTY_FORM: ShowForm = {
  eventId: '',
  venueId: '',
  startTime: '',
  endTime: '',
  status: 'SCHEDULED',
  provisionInventory: true,
  defaultPrice: '100',
}

// POST /api/v1/admin/shows, PUT /api/v1/admin/shows/:id
// List reuses the public GET /shows (showApi.listShows, toShowDetail shape).
export default function AdminShowsPage() {
  const [shows, setShows] = useState<ShowDetail[]>([])
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const [events, setEvents] = useState<Event[]>([])
  const [venues, setVenues] = useState<Venue[]>([])
  const [form, setForm] = useState<ShowForm>(EMPTY_FORM)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setIsLoading(true)
      setError(null)
      try {
        const [showsData, eventsData, venuesData] = await Promise.all([
          showApi.listShows({ limit: PAGE_SIZE, offset }),
          eventApi.listEvents({ limit: 100, status: 'PUBLISHED' }),
          venueApi.listVenues({ limit: 100 }),
        ])
        if (!cancelled) {
          setShows(showsData.shows)
          setTotal(showsData.total)
          setEvents(eventsData.events)
          setVenues(venuesData.venues)
        }
      } catch (err) {
        if (!cancelled) setError(extractErrorMessage(err, 'Failed to load shows'))
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [offset, notice])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setNotice(null)
    setIsSaving(true)
    try {
      if (editingId === null) {
        const input: CreateShowInput = {
          eventId: Number(form.eventId),
          venueId: Number(form.venueId),
          startTime: toBackendDateTime(form.startTime),
          endTime: toBackendDateTime(form.endTime),
          status: form.status,
          provisionInventory: form.provisionInventory,
          ...(form.provisionInventory ? { defaultPrice: Number(form.defaultPrice) } : {}),
        }
        const show = await adminApi.createShow(input)
        setNotice(`Show #${show.id} created for ${show.event.name}`)
      } else {
        const changes: UpdateShowInput = {
          startTime: toBackendDateTime(form.startTime),
          endTime: toBackendDateTime(form.endTime),
          status: form.status,
        }
        const show = await adminApi.updateShow(editingId, changes)
        setNotice(`Show #${show.id} updated`)
      }
      setForm(EMPTY_FORM)
      setEditingId(null)
      setOffset(0)
    } catch (err) {
      setNotice(extractErrorMessage(err, 'Failed to save show'))
    } finally {
      setIsSaving(false)
    }
  }

  function startEdit(show: ShowDetail) {
    setEditingId(show.id)
    setForm({
      eventId: String(show.eventId),
      venueId: String(show.venueId),
      startTime: toLocalInput(show.startTime),
      endTime: toLocalInput(show.endTime),
      status: (show.status as ShowStatus) ?? 'SCHEDULED',
      provisionInventory: false,
      defaultPrice: '',
    })
    setNotice(null)
  }

  async function quickStatusChange(show: ShowDetail, nextStatus: ShowStatus) {
    setNotice(null)
    try {
      const updated = await adminApi.updateShow(show.id, { status: nextStatus })
      setShows((prev) => prev.map((s) => (s.id === show.id ? { ...s, status: updated.status } : s)))
      setNotice(`Show #${show.id} status set to ${nextStatus}`)
    } catch (err) {
      setNotice(extractErrorMessage(err, 'Failed to update show'))
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1
  const inputClass =
    'px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500'
  return (
    <div>
      <AdminNav />
      <h1 className="text-2xl font-bold text-gray-900 mb-4">Shows</h1>

      <div className="bg-white shadow rounded-lg p-6 mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          {editingId === null ? 'Create show' : `Edit show #${editingId}`}
        </h2>
        <form className="grid grid-cols-1 md:grid-cols-2 gap-4" onSubmit={handleSave}>
          <label className="text-sm text-gray-700">
            Event
            <select aria-label="Show event" className={`${inputClass} block w-full mt-1`} value={form.eventId} onChange={(e) => setForm({ ...form, eventId: e.target.value })} required disabled={editingId !== null}>
              <option value="">Select an event…</option>
              {events.map((ev) => (
                <option key={ev.id} value={ev.id}>{ev.name} (#{ev.id})</option>
              ))}
            </select>
          </label>
          <label className="text-sm text-gray-700">
            Venue
            <select aria-label="Show venue" className={`${inputClass} block w-full mt-1`} value={form.venueId} onChange={(e) => setForm({ ...form, venueId: e.target.value })} required disabled={editingId !== null}>
              <option value="">Select a venue…</option>
              {venues.map((v) => (
                <option key={v.id} value={v.id}>{v.name} — {v.city} (#{v.id})</option>
              ))}
            </select>
          </label>
          <label className="text-sm text-gray-700">
            Start time
            <input aria-label="Show start time" type="datetime-local" className={`${inputClass} block w-full mt-1`} value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} required />
          </label>
          <label className="text-sm text-gray-700">
            End time
            <input aria-label="Show end time" type="datetime-local" className={`${inputClass} block w-full mt-1`} value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} required />
          </label>
          <label className="text-sm text-gray-700">
            Status
            <select aria-label="Show status" className={`${inputClass} block mt-1`} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as ShowStatus })}>
              {SHOW_STATUSES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </label>
          {editingId === null && (
            <>
              <label className="text-sm text-gray-700 flex items-center gap-2">
                <input aria-label="Provision seat inventory" type="checkbox" checked={form.provisionInventory} onChange={(e) => setForm({ ...form, provisionInventory: e.target.checked })} />
                Provision seat inventory
              </label>
              <label className="text-sm text-gray-700">
                Default price
                <input aria-label="Default price" type="number" min={0} step="0.01" className={`${inputClass} block w-full mt-1`} value={form.defaultPrice} onChange={(e) => setForm({ ...form, defaultPrice: e.target.value })} disabled={!form.provisionInventory} />
              </label>
            </>
          )}
          <div className="md:col-span-2 flex gap-3">
            <button type="submit" disabled={isSaving} className="px-4 py-2 text-sm font-medium bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50">
              {editingId === null ? 'Create show' : 'Save changes'}
            </button>
            {editingId !== null && (
              <button type="button" className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200" onClick={() => { setEditingId(null); setForm(EMPTY_FORM) }}>
                Cancel edit
              </button>
            )}
          </div>
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
        <p className="text-gray-500">Loading shows…</p>
      ) : shows.length === 0 ? (
        <p className="text-gray-500">No shows yet.</p>
      ) : (
        <div className="bg-white shadow rounded-lg overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-700">#</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Event</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Venue</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Start</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Seats</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Status</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {shows.map((s) => (
                <tr key={s.id}>
                  <td className="px-4 py-3 text-gray-600">{s.id}</td>
                  <td className="px-4 py-3 text-gray-900">{s.event.name}</td>
                  <td className="px-4 py-3 text-gray-600">{s.venue.name}, {s.venue.city}</td>
                  <td className="px-4 py-3 text-gray-600">{new Date(s.startTime).toLocaleString()}</td>
                  <td className="px-4 py-3 text-gray-600">{s.seats.available}/{s.seats.total} available</td>
                  <td className="px-4 py-3">
                    <select
                      aria-label={`Status for show ${s.id}`}
                      className={inputClass}
                      value={s.status}
                      onChange={(e) => quickStatusChange(s, e.target.value as ShowStatus)}
                    >
                      {SHOW_STATUSES.map((st) => (
                        <option key={st} value={st}>{st}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <button type="button" className="text-sm font-medium text-primary-700 hover:underline" onClick={() => startEdit(s)}>
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {!isLoading && !error && (
        <div className="mt-3 flex items-center gap-4 text-sm text-gray-500">
          <button type="button" className="px-3 py-1 border border-gray-300 rounded-md disabled:opacity-40" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}>
            Previous
          </button>
          <span>
            Page {currentPage} of {totalPages} ({total} shows)
          </span>
          <button type="button" className="px-3 py-1 border border-gray-300 rounded-md disabled:opacity-40" disabled={offset + PAGE_SIZE >= total} onClick={() => setOffset(offset + PAGE_SIZE)}>
            Next
          </button>
        </div>
      )}
    </div>
  )
}


