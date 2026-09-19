import { Link, NavLink, Outlet } from 'react-router-dom'
import { useAuthStore } from '../stores/auth'

export default function Layout() {
  const { token, user, logout } = useAuthStore()

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Link to="/" className="flex items-center space-x-2">
                <svg
                  className="w-8 h-8 text-primary-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z"
                  />
                </svg>
                <span className="text-xl font-bold text-gray-900">Ticket Booking</span>
              </Link>
            </div>
            <div className="flex items-center space-x-4">
              <div className="hidden md:flex items-center space-x-1">
                <NavLink
                  to="/"
                  end
                  className={({ isActive }) =>
                    `px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-primary-50 text-primary-700'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`
                  }
                >
                  Home
                </NavLink>
                <NavLink
                  to="/events"
                  className={({ isActive }) =>
                    `px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-primary-50 text-primary-700'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`
                  }
                >
                  Events
                </NavLink>
                <NavLink
                  to="/venues"
                  className={({ isActive }) =>
                    `px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-primary-50 text-primary-700'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`
                  }
                >
                  Venues
                </NavLink>
                {token && (
                  <NavLink
                    to="/bookings"
                    className={({ isActive }) =>
                      `px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                        isActive
                          ? 'bg-primary-50 text-primary-700'
                          : 'text-gray-700 hover:bg-gray-100'
                      }`
                    }
                  >
                    My Bookings
                  </NavLink>
                )}
                {token &&
                  user &&
                  ['ADMIN', 'EVENT_MANAGER', 'VENUE_MANAGER'].includes(user.role) && (
                    <NavLink
                      to="/admin/events"
                      className={({ isActive }) =>
                        `px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                          isActive
                            ? 'bg-primary-50 text-primary-700'
                            : 'text-gray-700 hover:bg-gray-100'
                        }`
                      }
                    >
                      Admin
                    </NavLink>
                  )}
              </div>
              {token && user ? (
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-700">{user.name}</span>
                  <button
                    onClick={() => logout()}
                    className="px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
                  >
                    Logout
                  </button>
                </div>
              ) : (
                <div className="flex items-center space-x-1">
                  <NavLink
                    to="/login"
                    className={({ isActive }) =>
                      `px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                        isActive
                          ? 'bg-primary-50 text-primary-700'
                          : 'text-gray-700 hover:bg-gray-100'
                      }`
                    }
                  >
                    Login
                  </NavLink>
                  <NavLink
                    to="/register"
                    className="px-3 py-2 rounded-md text-sm font-medium bg-primary-600 text-white hover:bg-primary-700 transition-colors"
                  >
                    Register
                  </NavLink>
                </div>
              )}
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="py-4">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
