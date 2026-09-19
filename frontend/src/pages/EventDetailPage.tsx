import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { eventApi } from '../api/events'
import type { Event, EventShow } from '../api/events'
import { extractErrorMessage } from '../api/client'

function formatDateTime(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString()
}

export default function EventDetailPage() {
  const { id } = useParams<{ id: string }>()
  const eventId = Number(id)
  const [event, setEvent] = useState<Event | null>(null)
  const [shows, setShows] = useState<EventShow[]>([])
  const [totalShows, setTotalShows] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!Number.isInteger(eventId) || eventId <= 0) {
      setIsLoading(false)
      setError('Invalid event id.')
      return
    }
    let cancelled = false
    setIsLoading(true)
    setError(null)
    Promise.all([eventApi.getEvent(eventId), eventApi.getEventShows(eventId, { limit: 50 })])
      .then(([loadedEvent, loadedShows]) => {
        if (cancelled) return
        setEvent(loadedEvent)
        setShows(loadedShows.shows)
        setTotalShows(loadedShows.total)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setError(extractErrorMessage(err, 'Could not load event'))
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [eventId])

  if (isLoading) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Event detail</h1>
        <p className="mt-2 text-sm text-gray-600">Loading event…</p>
      </div>
    )
  }

  if (error || !event) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Event detail</h1>
        <p role="alert" className="mt-2 text-sm text-red-600">
          {error ?? 'Event not found.'}
        </p>
        <p className="mt-4 text-sm">
          <Link to="/events" className="text-primary-600 hover:underline">
            Back to events
          </Link>
        </p>
      </div>
    )
  }

  return (
    <div className="max-w-3xl">
      <p className="text-sm">
        <Link to="/events" className="text-primary-600 hover:underline">
          Back to events
        </Link>
      </p>
      {event.posterUrl && (
        <img src={event.posterUrl} alt="" className="mt-4 h-64 w-full rounded-lg object-cover" />
      )}
      <h1 className="mt-4 text-3xl font-bold text-gray-900">{event.name}</h1>
      {event.category && (
        <p className="mt-1 text-xs font-medium uppercase tracking-wide text-gray-500">
          {event.category}
        </p>
      )}
      {event.description && <p className="mt-4 text-gray-700">{event.description}</p>}

      <h2 className="mt-8 text-xl font-semibold text-gray-900">
        Shows {totalShows > 0 && <span className="text-sm font-normal text-gray-500">({totalShows})</span>}
      </h2>
      {shows.length === 0 ? (
        <p className="mt-2 text-sm text-gray-600">No shows scheduled yet.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {shows.map((show) => (
            <li key={show.id} className="rounded-lg border border-gray-200 bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-medium text-gray-900">{show.venue.name}</p>
                  <p className="text-sm text-gray-600">
                    {formatDateTime(show.startTime)}
                    {show.venue.city ? ` · ${show.venue.city}` : ''}
                  </p>
                </div>
                <Link
                  to={`/shows/${show.id}`}
                  className="rounded-md bg-primary-600 px-3 py-1 text-sm font-medium text-white hover:bg-primary-700"
                >
                  View show
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
