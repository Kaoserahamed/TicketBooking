import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { adminApi, type CreateVenueInput } from '../api/admin'
import { venueApi, type Venue } from '../api/venues'
import { extractErrorMessage } from '../api/client'
import AdminNav from '../components/AdminNav'

const PAGE_SIZE = 10

interface VenueForm {
  name: string
  city: string
  address: string
  capacity: string
}

const EMPTY_FORM: VenueForm = { name: '', city: '', address: '', capacity: '' }

// POST /api/v1/admin/venues, PUT /api/v1/admin/venues/:id
// List reuses the public GET /venues catalogue (venueApi.listVenues).
export default function AdminVenuesPage() {
  const [venues, setVenues] = useState<Venue[]>([])
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const [form, setForm] = useState<VenueForm>(EMPTY_FORM)
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
        const data = await venueApi.listVenues({ limit: PAGE_SIZE, offset })
        if (!cancelled) {
          setVenues(data.venues)
          setTotal(data.total)
        }
      } catch (err) {
        if (!cancelled) setError(extractErrorMessage(err, 'Failed to load venues'))
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
      const input: CreateVenueInput = {
        name: form.name,
        city: form.city,
        address: form.address || null,
        capacity: Number(form.capacity),
      }
      if (editingId === null) {
        await adminApi.createVenue(input)
        setNotice(`Venue created: ${form.name}`)
      } else {
        await adminApi.updateVenue(editingId, input)
        setNotice(`Venue updated: ${form.name}`)
      }
      setForm(EMPTY_FORM)
      setEditingId(null)
      setOffset(0)
    } catch (err) {
      setNotice(extractErrorMessage(err, 'Failed to save venue'))
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
      <h1 className="text-2xl font-bold text-gray-900 mb-4">Venues</h1>

      <div className="bg-white shadow rounded-lg p-6 mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          {editingId === null ? 'Create venue' : `Edit venue #${editingId}`}
        </h2>
        <form className="grid grid-cols-1 md:grid-cols-2 gap-4" onSubmit={handleSave}>
          <label className="text-sm text-gray-700">
            Name
            <input
              aria-label="Venue name"
              className={`${inputClass} block w-full mt-1`}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </label>
          <label className="text-sm text-gray-700">
            City
            <input
              aria-label="Venue city"
              className={`${inputClass} block w-full mt-1`}
              value={form.city}
              onChange={(e) => setForm({ ...form, city: e.target.value })}
              required
            />
          </label>
          <label className="text-sm text-gray-700">
            Address
            <input
              aria-label="Venue address"
              className={`${inputClass} block w-full mt-1`}
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
            />
          </label>
          <label className="text-sm text-gray-700">
            Capacity
            <input
              aria-label="Venue capacity"
              type="number"
              min={1}
              className={`${inputClass} block w-full mt-1`}
              value={form.capacity}
              onChange={(e) => setForm({ ...form, capacity: e.target.value })}
              required
            />
          </label>
          <div className="md:col-span-2 flex gap-3">
            <button
              type="submit"
              disabled={isSaving}
              className="px-4 py-2 text-sm font-medium bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50"
            >
              {editingId === null ? 'Create venue' : 'Save changes'}
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

      {error && (
        <div
          role="alert"
          className="mb-4 px-4 py-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md"
        >
          {error}
        </div>
      )}
      {isLoading ? (
        <p className="text-gray-500">Loading venues…</p>
      ) : venues.length === 0 ? (
        <p className="text-gray-500">No venues yet.</p>
      ) : (
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-700">#</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Name</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">City</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Capacity</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Seats</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {venues.map((v) => (
                <tr key={v.id}>
                  <td className="px-4 py-3 text-gray-600">{v.id}</td>
                  <td className="px-4 py-3 text-gray-900">{v.name}</td>
                  <td className="px-4 py-3 text-gray-600">{v.city ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{v.capacity}</td>
                  <td className="px-4 py-3 text-gray-600">{v.seats ? v.seats.total : '—'}</td>
                  <td className="px-4 py-3 flex gap-3">
                    <button
                      type="button"
                      className="text-sm font-medium text-primary-700 hover:underline"
                      onClick={() => {
                        setEditingId(v.id)
                        setForm({
                          name: v.name,
                          city: v.city ?? '',
                          address: v.address ?? '',
                          capacity: String(v.capacity),
                        })
                        setNotice(null)
                      }}
                    >
                      Edit
                    </button>
                    <Link
                      to={`/admin/venues/${v.id}/seats`}
                      className="text-sm font-medium text-primary-700 hover:underline"
                    >
                      Seats
                    </Link>
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
            Page {currentPage} of {totalPages} ({total} venues)
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
