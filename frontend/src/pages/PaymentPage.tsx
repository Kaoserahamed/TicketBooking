import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { bookingApi, newIdempotencyKey } from '../api/bookings'
import type { Booking } from '../api/bookings'
import { paymentApi, TERMINAL_PAYMENT_STATUSES } from '../api/payments'
import type { Payment, PaymentProvider } from '../api/payments'
import { extractErrorMessage } from '../api/client'

const PROVIDERS: { value: PaymentProvider; label: string }[] = [
  { value: 'BKASH', label: 'bKash' },
  { value: 'NAGAD', label: 'Nagad' },
]

// Payment flow (docs/04-api-design.md §4.6): load the held booking, pick a
// wallet provider (bKash/Nagad — credentials live in backend env), create the
// payment, then poll GET /payments/{id} until the gateway settles it.
export default function PaymentPage() {
  const { id } = useParams<{ id: string }>()
  const bookingId = Number(id)
  const [booking, setBooking] = useState<Booking | null>(null)
  const [payment, setPayment] = useState<Payment | null>(null)
  const [provider, setProvider] = useState<PaymentProvider>('BKASH')
  const [payerPhone, setPayerPhone] = useState('')
  const [isPaying, setIsPaying] = useState(false)
  const [isChecking, setIsChecking] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!Number.isInteger(bookingId) || bookingId <= 0) {
      setError('Invalid booking id.')
      return
    }
    let cancelled = false
    async function load() {
      try {
        const detail = await bookingApi.getBooking(bookingId)
        if (!cancelled) setBooking(detail.booking)
      } catch (err) {
        if (!cancelled) setError(extractErrorMessage(err, 'Could not load booking'))
      }
    }
    void load()
    return () => {
      cancelled = true
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [bookingId])

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }, [])

  const checkStatus = useCallback(
    async (paymentId: number) => {
      setIsChecking(true)
      try {
        const updated = await paymentApi.getPayment(paymentId)
        setPayment(updated)
        if (updated.status === 'COMPLETED') {
          stopPolling()
          setNotice('Payment completed! Your booking is confirmed.')
        } else if (TERMINAL_PAYMENT_STATUSES.includes(updated.status)) {
          stopPolling()
          setError(
            `Payment ${updated.status.toLowerCase()}. No money was captured — you can try again.`
          )
        }
      } catch (err) {
        setError(extractErrorMessage(err, 'Could not check payment status'))
      } finally {
        setIsChecking(false)
      }
    },
    [stopPolling]
  )

  function startPolling(paymentId: number) {
    stopPolling()
    pollRef.current = setInterval(() => {
      void checkStatus(paymentId)
    }, 3000)
  }

  async function onPay() {
    if (!booking || isPaying) return
    if (payerPhone && !/^01\d{9}$/.test(payerPhone)) {
      setError('Enter a valid wallet number (11 digits, e.g. 01712345678).')
      return
    }
    setError(null)
    setNotice(null)
    setIsPaying(true)
    try {
      const created = await paymentApi.createPayment(
        {
          bookingId: booking.id,
          provider,
          ...(payerPhone ? { payerPhone } : {}),
        },
        newIdempotencyKey()
      )
      setPayment(created)
      if (created.status === 'COMPLETED') {
        setNotice('Payment completed! Your booking is confirmed.')
      } else if (TERMINAL_PAYMENT_STATUSES.includes(created.status)) {
        setError(
          `Payment ${created.status.toLowerCase()} immediately. No money was captured — you can try again.`
        )
      } else {
        setNotice(
          `Payment initiated via ${PROVIDERS.find((p) => p.value === created.provider)?.label ?? created.provider}. Approve it on your phone, then check the status below.`
        )
        startPolling(created.id)
      }
    } catch (err) {
      setError(extractErrorMessage(err, 'Could not start payment'))
    } finally {
      setIsPaying(false)
    }
  }

  const inputClass =
    'px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500'
  if (!Number.isInteger(bookingId) || bookingId <= 0) {
    return (
      <div className="max-w-2xl">
        <div role="alert" className="text-sm text-red-600">
          Invalid booking id
        </div>
        <Link to="/bookings" className="text-sm text-primary-700 hover:underline">
          ← Back to my bookings
        </Link>
      </div>
    )
  }

  const settled = payment !== null && TERMINAL_PAYMENT_STATUSES.includes(payment.status)
  const completed = payment?.status === 'COMPLETED'

  return (
    <div className="max-w-2xl">
      <Link to={`/bookings/${bookingId}`} className="text-sm text-primary-700 hover:underline">
        ← Back to booking
      </Link>
      <h1 className="text-2xl font-bold text-gray-900 mt-2 mb-4">Payment</h1>

      {booking && (
        <div className="mb-6 rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-sm text-gray-600">
            Booking <span className="font-semibold text-gray-900">{booking.bookingReference}</span>
          </p>
          <p className="text-sm text-gray-600">
            {booking.show.event.name} — {booking.show.venue.name}, {booking.show.venue.city}
          </p>
          <p className="mt-1 text-sm text-gray-600">
            {booking.items.length} seat(s) · total{' '}
            <span className="font-semibold text-gray-900">
              {booking.currency} {booking.totalAmount.toFixed(2)}
            </span>
          </p>
        </div>
      )}

      {error && (
        <p role="alert" className="mb-4 text-sm text-red-600">
          {error}
        </p>
      )}
      {notice && <p className="mb-4 text-sm text-green-700">{notice}</p>}

      {settled ? (
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <p className="text-sm text-gray-600">
            Payment <span className="font-medium text-gray-900">{payment!.status}</span>
            {payment!.trxId ? ` · txn ${payment!.trxId}` : ''}
          </p>
          {completed && payment!.ticketId && (
            <p className="mt-3">
              <Link
                to={`/tickets/${payment!.ticketId}`}
                className="font-medium text-primary-700 hover:underline"
              >
                View your ticket →
              </Link>
            </p>
          )}
          {!completed && (
            <p className="mt-3 text-sm text-gray-500">No money was captured. You can try again.</p>
          )}
        </div>
      ) : (
        <form
          className="rounded-lg border border-gray-200 bg-white p-6"
          onSubmit={(e) => {
            e.preventDefault()
            void onPay()
          }}
        >
          <fieldset className="mb-4">
            <legend className="text-sm font-medium text-gray-700 mb-2">Payment method</legend>
            <div className="flex gap-4">
              {PROVIDERS.map((p) => (
                <label key={p.value} className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="radio"
                    name="provider"
                    aria-label={`Pay with ${p.label}`}
                    value={p.value}
                    checked={provider === p.value}
                    onChange={() => setProvider(p.value)}
                  />
                  {p.label}
                </label>
              ))}
            </div>
          </fieldset>
          <label className="block text-sm text-gray-700">
            Wallet number (optional)
            <input
              aria-label="Wallet number"
              className={`${inputClass} mt-1 block w-full`}
              value={payerPhone}
              onChange={(e) => setPayerPhone(e.target.value)}
              placeholder="01712345678"
            />
          </label>
          <button
            type="submit"
            disabled={isPaying}
            className="mt-4 rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
          >
            {isPaying
              ? 'Starting payment…'
              : `Pay ${booking ? `${booking.currency} ${booking.totalAmount.toFixed(2)}` : ''}`}
          </button>
        </form>
      )}

      {payment && !settled && (
        <div className="mt-6 rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-sm text-gray-600">
            Payment #{payment.id} · <span className="font-medium">{payment.status}</span> via{' '}
            {PROVIDERS.find((p) => p.value === payment.provider)?.label ?? payment.provider}
          </p>
          <button
            type="button"
            className="mt-3 rounded-md border border-gray-300 px-3 py-1 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            disabled={isChecking}
            onClick={() => void checkStatus(payment.id)}
          >
            {isChecking ? 'Checking…' : 'Check status now'}
          </button>
        </div>
      )}
    </div>
  )
}
