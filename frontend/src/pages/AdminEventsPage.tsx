import { useEffect, useState } from 'react'
import { adminApi, type EventStatus, type AdminListEventsParams } from '../api/admin'
import type { Event } from '../api/events'
import { extractErrorMessage } from '../api/client'
import AdminNav from '../components/AdminNav'

const STATUSES: EventStatus[] = ['DRAFT', 'PUBLISHED', 'ACTIVE', 'INACTIVE', 'CANCELLED']
const PAGE_SIZE = 10

interface EventForm {
  name: string
  category: string
  description: string
  posterUrl: string
  status: EventStatus
}

const EMPTY_FORM: EventForm = {
  name: '',
  category: '',
  description: '',
  posterUrl: '',
  status: 'DRAFT',
}

// GET/POST /api/v1/admin/events, PUT /api/v1/admin/events/:id
export default function AdminEventsPage() {
  const [events, setEvents] = useState<Event[]>([])
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [status, setStatus] = useState('')
  const [applied, setApplied] = useState<{
    search?: string
    category?: string
    status?: EventStatus
  }>({})
  const [form, setForm] = useState<EventForm>(EMPTY_FORM)
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
        const params: AdminListEventsParams = { limit: PAGE_SIZE, offset }
        if (applied.search) params.search = applied.search
        if (applied.category) params.category = applied.category
        if (applied.status) params.status = applied.status
        const data = await adminApi.listEvents(params)
        if (!cancelled) {
          setEvents(data.events)
          setTotal(data.total)
        }
      } catch (err) {
        if (!cancelled) setError(extractErrorMessage(err, 'Failed to load events'))
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [applied, offset])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setNotice(null)
    setIsSaving(true)
    try {
      const payload = {
        name: form.name,
        category: form.category || null,
        description: form.description || null,
        posterUrl: form.posterUrl || null,
        status: form.status,
      }
      if (editingId === null) {
        await adminApi.createEvent(payload)
        setNotice(`Event created: ${form.name}`)
      } else {
        await adminApi.updateEvent(editingId, payload)
        setNotice(`Event updated: ${form.name}`)
      }
      setForm(EMPTY_FORM)
      setEditingId(null)
      setOffset(0)
      setApplied((prev) => ({ ...prev })) // retrigger the list reload
    } catch (err) {
      setNotice(extractErrorMessage(err, 'Failed to save event'))
    } finally {
      setIsSaving(false)
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1
  const inputClass =
    'px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500'
  return (
    <div>
      <AdminNav />
      <h1 className="text-2xl font-bold text-gray-900 mb-4">Events</h1>

      <div className="bg-white shadow rounded-lg p-6 mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          {editingId === null ? 'Create event' : `Edit event #${editingId}`}
        </h2>
        <form className="grid grid-cols-1 md:grid-cols-2 gap-4" onSubmit={handleSave}>
          <label className="text-sm text-gray-700">
            Name
            <input
              aria-label="Event name"
              className={`${inputClass} block w-full mt-1`}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </label>
          <label className="text-sm text-gray-700">
            Category
            <input
              aria-label="Event category"
              className={`${inputClass} block w-full mt-1`}
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
            />
          </label>
          <label className="text-sm text-gray-700 md:col-span-2">
            Description
            <textarea
              aria-label="Event description"
              rows={2}
              className={`${inputClass} block w-full mt-1`}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </label>
          <label className="text-sm text-gray-700">
            Poster URL
            <input
              aria-label="Event poster URL"
              className={`${inputClass} block w-full mt-1`}
              value={form.posterUrl}
              onChange={(e) => setForm({ ...form, posterUrl: e.target.value })}
            />
          </label>
          <label className="text-sm text-gray-700">
            Status
            <select
              aria-label="Event status"
              className={`${inputClass} block mt-1`}
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value as EventStatus })}
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <div className="md:col-span-2 flex gap-3">
            <button
              type="submit"
              disabled={isSaving}
              className="px-4 py-2 text-sm font-medium bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50"
            >
              {editingId === null ? 'Create event' : 'Save changes'}
            </button>
            {editingId !== null && (
              <button
                type="button"
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                onClick={() => {
                  setEditingId(null)
                  setForm(EMPTY_FORM)
                }}
              >
                Cancel edit
              </button>
            )}
          </div>
        </form>
        {notice && (
          <p role="status" className="mt-4 text-sm text-gray-700">
            {notice}
          </p>
        )}
      </div>

      <FilterBar
        search={search}
        category={category}
        status={status}
        setSearch={setSearch}
        setCategory={setCategory}
        setStatus={setStatus}
        onApply={() => {
          setOffset(0)
          setApplied({
            search: search || undefined,
            category: category || undefined,
            status: (status || undefined) as EventStatus | undefined,
          })
        }}
      />

      {error && (
        <div
          role="alert"
          className="mb-4 px-4 py-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md"
        >
          {error}
        </div>
      )}
      {isLoading ? (
        <p className="text-gray-500">Loading events…</p>
      ) : events.length === 0 ? (
        <p className="text-gray-500">No events match these filters.</p>
      ) : (
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-700">#</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Name</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Category</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Status</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {events.map((ev) => (
                <tr key={ev.id}>
                  <td className="px-4 py-3 text-gray-600">{ev.id}</td>
                  <td className="px-4 py-3 text-gray-900">{ev.name}</td>
                  <td className="px-4 py-3 text-gray-600">{ev.category ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{ev.status}</td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      className="text-sm font-medium text-primary-700 hover:underline"
                      onClick={() => {
                        setEditingId(ev.id)
                        setForm({
                          name: ev.name,
                          category: ev.category ?? '',
                          description: ev.description ?? '',
                          posterUrl: ev.posterUrl ?? '',
                          status: (ev.status as EventStatus) ?? 'DRAFT',
                        })
                        setNotice(null)
                      }}
                    >
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
          <button
            type="button"
            className="px-3 py-1 border border-gray-300 rounded-md disabled:opacity-40"
            disabled={offset === 0}
            onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
          >
            Previous
          </button>
          <span>
            Page {currentPage} of {totalPages} ({total} events)
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

function FilterBar(props: {
  search: string
  category: string
  status: string
  setSearch: (v: string) => void
  setCategory: (v: string) => void
  setStatus: (v: string) => void
  onApply: () => void
}) {
  const inputClass =
    'px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500'
  return (
    <form
      className="flex flex-wrap items-end gap-3 mb-6"
      onSubmit={(e) => {
        e.preventDefault()
        props.onApply()
      }}
    >
      <label className="text-sm text-gray-700">
        Search
        <input
          aria-label="Search events"
          className={`${inputClass} block mt-1`}
          value={props.search}
          onChange={(e) => props.setSearch(e.target.value)}
        />
      </label>
      <label className="text-sm text-gray-700">
        Category
        <input
          aria-label="Filter by category"
          className={`${inputClass} block mt-1`}
          value={props.category}
          onChange={(e) => props.setCategory(e.target.value)}
        />
      </label>
      <label className="text-sm text-gray-700">
        Status
        <select
          aria-label="Filter by event status"
          className={`${inputClass} block mt-1`}
          value={props.status}
          onChange={(e) => props.setStatus(e.target.value)}
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
  )
}
