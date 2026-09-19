import { NavLink } from 'react-router-dom'

const TABS = [
  { to: '/admin/users', label: 'Users' },
  { to: '/admin/events', label: 'Events' },
  { to: '/admin/venues', label: 'Venues' },
  { to: '/admin/shows', label: 'Shows' },
  { to: '/admin/bookings', label: 'Bookings' },
]

const tabClass = ({ isActive }: { isActive: boolean }) =>
  `px-3 py-2 rounded-t-md text-sm font-medium border-b-2 transition-colors ${
    isActive
      ? 'border-primary-600 text-primary-700 bg-primary-50'
      : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-100'
  }`

/** Shared tab navigation across the admin pages. */
export default function AdminNav() {
  return (
    <nav aria-label="Admin sections" className="flex space-x-2 border-b border-gray-200 mb-6">
      {TABS.map((t) => (
        <NavLink key={t.to} to={t.to} className={tabClass}>
          {t.label}
        </NavLink>
      ))}
    </nav>
  )
}
