import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ticketApi } from '../api/tickets'
import type { Ticket } from '../api/tickets'
import { extractErrorMessage } from '../api/client'

// Ticket details + QR (docs/04-api-design.md §4.7). Reached from the payment
// success screen or My bookings → View ticket.
export default function TicketDetailPage() {
  const { id } = useParams<{ id: string }>()
  const ticketId = Number(id)
  const [ticket, setTicket] = useState<Ticket | null>(null)
  const [qrUrl, setQrUrl] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const invalid = !Number.isInteger(ticketId) || ticketId <= 0

  useEffect(() => {
    if (invalid) {
      setError('Invalid ticket id')
      setIsLoading(false)
      return
    }
    let cancelled = false
    const createdUrl: { url: string | null } = { url: null }
    async function load() {
      setIsLoading(true)
      setError(null)
      try {
        const t = await ticketApi.getTicket(ticketId)
        if (cancelled) return
        setTicket(t)
        try {
          const url = await ticketApi.getTicketQrUrl(ticketId)
          createdUrl.url = url
          if (!cancelled) setQrUrl(url)
        } catch {
          // QR endpoint failure alone must not hide the ticket details.
          if (!cancelled) setQrUrl(null)
        }
      } catch (err) {
        if (!cancelled) setError(extractErrorMessage(err, 'Could not load ticket'))
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
      if (createdUrl.url) URL.revokeObjectURL(createdUrl.url)
    }
  }, [ticketId, invalid])

  if (invalid) {
    return (
      <div className="max-w-2xl">
        <div role="alert" className="text-sm text-red-600">
          Invalid ticket id
        </div>
        <Link to="/bookings" className="text-sm text-primary-700 hover:underline">
          ← Back to my bookings
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-2xl">
      <Link to="/bookings" className="text-sm text-primary-700 hover:underline">
        ← Back to my bookings
      </Link>
      <h1 className="text-2xl font-bold text-gray-900 mt-2 mb-4">Ticket</h1>

      {error && (
        <p role="alert" className="mb-4 text-sm text-red-600">
          {error}
        </p>
      )}
      {isLoading ? (
        <p className="text-sm text-gray-600">Loading ticket…</p>
      ) : ticket ? (
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm text-gray-500">Ticket number</p>
              <p className="text-lg font-semibold text-gray-900">{ticket.ticketNumber}</p>
              <p className="mt-2 text-sm text-gray-600">
                Status: <span className="font-medium">{ticket.status}</span>
              </p>
              <p className="mt-1 text-sm text-gray-600">
                Issued: {new Date(ticket.issuedAt).toLocaleString()}
              </p>
              {ticket.usedAt && (
                <p className="mt-1 text-sm text-gray-600">
                  Used: {new Date(ticket.usedAt).toLocaleString()}
                </p>
              )}
            </div>
            <div className="text-center">
              {qrUrl ? (
                <img
                  src={qrUrl}
                  alt={`QR code for ticket ${ticket.ticketNumber}`}
                  className="h-40 w-40 rounded border border-gray-200 bg-white"
                />
              ) : (
                <p className="text-xs text-gray-400">QR unavailable</p>
              )}
            </div>
          </div>
          <p className="mt-6">
            <Link
              to={`/bookings/${ticket.bookingId}`}
              className="text-sm text-primary-700 hover:underline"
            >
              View booking #{ticket.bookingId} →
            </Link>
          </p>
        </div>
      ) : null}
    </div>
  )
}
