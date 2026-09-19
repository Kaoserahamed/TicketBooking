import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { eventApi } from '../api/events'
import type { Event } from '../api/events'
import { showApi } from '../api/shows'
import type { ShowDetail } from '../api/shows'
import { extractErrorMessage } from '../api/client'

const FEATURED_LIMIT = 6

/** Render a show/event datetime in a stable, locale-friendly way. */
function formatDateTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function HomePage() {
  const [events, setEvents] = useState<Event[]>([])
  const [shows, setShows] = useState<ShowDetail[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    setError(null)
    // Public endpoints only: GET /events (PUBLISHED/ACTIVE) and
    // GET /shows?upcoming=true (start_time in the future).
    Promise.all([
      eventApi.listEvents({ limit: FEATURED_LIMIT }),
      showApi.listShows({ upcoming: true, limit: FEATURED_LIMIT }),
    ])
      .then(([eventList, showList]) => {
        if (cancelled) return
        setEvents(eventList.events)
        setShows(showList.shows)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setError(extractErrorMessage(err, 'Could not load the latest events and shows'))
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div>
      <section className="rounded-lg bg-primary-50 p-8 text-center">
        <h1 className="text-3xl font-bold text-gray-900">Ticket Booking System</h1>
        <p className="mt-2 text-gray-700">Discover events and book tickets in seconds.</p>
        <Link
          to="/events"
          className="mt-4 inline-block rounded-md bg-primary-600 px-6 py-2 text-sm font-medium text-white hover:bg-primary-700"
        >
          Browse events
        </Link>
      </section>

      {isLoading && <p className="mt-8 text-sm text-gray-600">Loading events and shows…</p>}
      {error && (
        <p role="alert" className="mt-8 text-sm text-red-600">
          {error}
        </p>
      )}

      {!isLoading && !error && (
        <>
          <section className="mt-8">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">Featured events</h2>
              <Link to="/events" className="text-sm text-primary-600 hover:underline">
                View all
              </Link>
            </div>
            {events.length === 0 ? (
              <p className="mt-4 text-sm text-gray-600">No events published yet.</p>
            ) : (
              <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {events.map((event) => (
                  <li
                    key={event.id}
                    className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
                  >
                    {event.posterUrl && (
                      <img
                        src={event.posterUrl}
                        alt={event.name}
                        className="mb-3 h-40 w-full rounded-md object-cover"
                      />
                    )}
                    <h3 className="text-lg font-semibold text-gray-900">
                      <Link to={`/events/${event.id}`} className="hover:underline">
                        {event.name}
                      </Link>
                    </h3>
                    <p className="mt-1 text-sm text-gray-600">
                      {event.category ?? 'Uncategorised'}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="mt-10">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">Upcoming shows</h2>
              <Link to="/events" className="text-sm text-primary-600 hover:underline">
                Browse events
              </Link>
            </div>
            {shows.length === 0 ? (
              <p className="mt-4 text-sm text-gray-600">No upcoming shows scheduled.</p>
            ) : (
              <ul className="mt-4 space-y-3">
                {shows.map((show) => (
                  <li
                    key={show.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
                  >
                    <div>
                      <h3 className="text-base font-semibold text-gray-900">
                        <Link to={`/shows/${show.id}`} className="hover:underline">
                          {show.event.name}
                        </Link>
                      </h3>
                      <p className="mt-1 text-sm text-gray-600">
                        {show.venue.name}, {show.venue.city ?? '—'} ·{' '}
                        {formatDateTime(show.startTime)}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-sm text-gray-600">
                        {show.seats ? `${show.seats.available} tickets available` : 'Details'}
                      </span>
                      <Link
                        to={`/shows/${show.id}`}
                        className="ml-3 text-sm font-medium text-primary-600 hover:underline"
                      >
                        View show
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  )
}
