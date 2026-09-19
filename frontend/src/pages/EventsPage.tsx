import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { eventApi } from '../api/events'
import type { Event } from '../api/events'
import { extractErrorMessage } from '../api/client'

const PAGE_SIZE = 12

export default function EventsPage() {
  const [events, setEvents] = useState<Event[]>([])
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const [search, setSearch] = useState('')
  const [appliedSearch, setAppliedSearch] = useState('')
  const [category, setCategory] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    setError(null)
    eventApi
      .listEvents({ search: appliedSearch || undefined, category: category || undefined, limit: PAGE_SIZE, offset })
      .then((result) => {
        if (cancelled) return
        setEvents(result.events)
        setTotal(result.total)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setError(extractErrorMessage(err, 'Could not load events'))
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [appliedSearch, category, offset])

  function onSearchSubmit(event: FormEvent) {
    event.preventDefault()
    setOffset(0)
    setAppliedSearch(search.trim())
  }

  const page = Math.floor(offset / PAGE_SIZE) + 1
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Events</h1>
      <form onSubmit={onSearchSubmit} className="mt-4 flex flex-col gap-2 sm:flex-row">
        <input
          type="search"
          aria-label="Search events"
          placeholder="Search events…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 rounded-md border border-gray-300 px-3 py-2"
        />
        <input
          aria-label="Filter by category"
          placeholder="Category"
          value={category}
          onChange={(e) => {
            setCategory(e.target.value)
            setOffset(0)
          }}
          className="rounded-md border border-gray-300 px-3 py-2 sm:w-48"
        />
        <button
          type="submit"
          className="rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
        >
          Search
        </button>
      </form>

      {isLoading && <p className="mt-6 text-sm text-gray-600">Loading events…</p>}
      {error && (
        <p role="alert" className="mt-6 text-sm text-red-600">
          {error}
        </p>
      )}

      {!isLoading && !error && events.length === 0 && (
        <p className="mt-6 text-sm text-gray-600">No events found.</p>
      )}

      {!isLoading && !error && events.length > 0 && (
        <>
          <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {events.map((event) => (
              <li key={event.id} className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                {event.posterUrl && (
                  <img
                    src={event.posterUrl}
                    alt=""
                    className="mb-3 h-40 w-full rounded-md object-cover"
                    loading="lazy"
                  />
                )}
                <h2 className="text-lg font-semibold text-gray-900">
                  <Link to={`/events/${event.id}`} className="hover:underline">
                    {event.name}
                  </Link>
                </h2>
                {event.category && (
                  <p className="mt-1 text-xs font-medium uppercase tracking-wide text-gray-500">
                    {event.category}
                  </p>
                )}
                {event.description && (
                  <p className="mt-2 line-clamp-3 text-sm text-gray-600">{event.description}</p>
                )}
              </li>
            ))}
          </ul>

          <div className="mt-6 flex items-center gap-4">
            <button
              type="button"
              disabled={offset === 0}
              onClick={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))}
              className="rounded-md border border-gray-300 px-3 py-1 text-sm disabled:opacity-50"
            >
              Previous
            </button>
            <span className="text-sm text-gray-600">
              Page {page} of {pageCount} ({total} events)
            </span>
            <button
              type="button"
              disabled={offset + PAGE_SIZE >= total}
              onClick={() => setOffset((o) => o + PAGE_SIZE)}
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
