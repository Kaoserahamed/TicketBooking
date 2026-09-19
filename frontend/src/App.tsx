import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from './stores/auth'
import Layout from './components/Layout'
import HomePage from './pages/HomePage'
import EventsPage from './pages/EventsPage'
import EventDetailPage from './pages/EventDetailPage'
import ShowDetailPage from './pages/ShowDetailPage'
import BookShowPage from './pages/BookShowPage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import VerifyEmailPage from './pages/VerifyEmailPage'
import ForgotPasswordPage from './pages/ForgotPasswordPage'
import ResetPasswordPage from './pages/ResetPasswordPage'
import ProfilePage from './pages/ProfilePage'
import BookingsPage from './pages/BookingsPage'
import BookingDetailPage from './pages/BookingDetailPage'
import PaymentPage from './pages/PaymentPage'
import TicketDetailPage from './pages/TicketDetailPage'
import VenuesPage from './pages/VenuesPage'
import VenueDetailPage from './pages/VenueDetailPage'
import AdminUsersPage from './pages/AdminUsersPage'
import AdminEventsPage from './pages/AdminEventsPage'
import AdminVenuesPage from './pages/AdminVenuesPage'
import AdminVenueSeatsPage from './pages/AdminVenueSeatsPage'
import AdminShowsPage from './pages/AdminShowsPage'
import AdminBookingsPage from './pages/AdminBookingsPage'

// Roles allowed into the admin area. Real RBAC is enforced server-side
// (docs/11-security.md §11.1) — this guard is UX only.
const ADMIN_ROLES = ['ADMIN', 'EVENT_MANAGER', 'VENUE_MANAGER']

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { token, user } = useAuthStore()
  const location = useLocation()
  if (!token) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }
  if (user && !ADMIN_ROLES.includes(user.role)) {
    return <Navigate to="/" replace />
  }
  return <>{children}</>
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { token } = useAuthStore()
  const location = useLocation()
  if (!token) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }
  return <>{children}</>
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="events" element={<EventsPage />} />
        <Route path="events/:id" element={<EventDetailPage />} />
        <Route path="shows/:id" element={<ShowDetailPage />} />
        <Route path="book/:showId" element={<ProtectedRoute><BookShowPage /></ProtectedRoute>} />
        <Route path="login" element={<LoginPage />} />
        <Route path="register" element={<RegisterPage />} />
        <Route path="verify-email" element={<VerifyEmailPage />} />
        <Route path="forgot-password" element={<ForgotPasswordPage />} />
        <Route path="reset-password" element={<ResetPasswordPage />} />
        <Route path="profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
        <Route path="bookings" element={<ProtectedRoute><BookingsPage /></ProtectedRoute>} />
        <Route path="bookings/:id" element={<ProtectedRoute><BookingDetailPage /></ProtectedRoute>} />
        <Route path="bookings/:id/pay" element={<ProtectedRoute><PaymentPage /></ProtectedRoute>} />
        <Route path="tickets/:id" element={<ProtectedRoute><TicketDetailPage /></ProtectedRoute>} />
        <Route path="venues" element={<VenuesPage />} />
        <Route path="venues/:id" element={<VenueDetailPage />} />
        <Route path="admin" element={<AdminRoute><AdminUsersPage /></AdminRoute>} />
        <Route path="admin/users" element={<AdminRoute><AdminUsersPage /></AdminRoute>} />
        <Route path="admin/events" element={<AdminRoute><AdminEventsPage /></AdminRoute>} />
        <Route path="admin/venues" element={<AdminRoute><AdminVenuesPage /></AdminRoute>} />
        <Route path="admin/venues/:id/seats" element={<AdminRoute><AdminVenueSeatsPage /></AdminRoute>} />
        <Route path="admin/shows" element={<AdminRoute><AdminShowsPage /></AdminRoute>} />
        <Route path="admin/bookings" element={<AdminRoute><AdminBookingsPage /></AdminRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
