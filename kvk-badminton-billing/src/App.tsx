import { Route, Routes, Navigate } from "react-router-dom"
import Login from "./pages/login"
import Payments from "./pages/payments"
import SettingsPage from "./pages/settings"
import AdminLayout from "./layouts/admin-layout"
import Dayend from "./pages/dayend"
import Today from "./pages/today"
import Bookings from "./pages/bookings"
import CourtSettings from "./pages/court-settings"
import SpecialBookingsPage from "./pages/bookings/special-bookings"
import SpecialBookingsAvailability from "./pages/bookings/special-bookings/availability"
import PaymentSlipHoldsPage from "./pages/bookings/special-bookings/payment-slip-holds"

function App() {
  return (
    <Routes>
      <Route path="/" element={<Login />} />
      
      {/* Admin Dashboard Routes */}
      <Route element={<AdminLayout><CourtSettings /></AdminLayout>} path="/court-settings" />
      <Route element={<AdminLayout><Bookings /></AdminLayout>} path="/bookings" />
      <Route element={<AdminLayout><Today /></AdminLayout>} path="/today" />
      <Route element={<AdminLayout><SpecialBookingsPage /></AdminLayout>} path="/special-bookings" />
      <Route element={<AdminLayout><PaymentSlipHoldsPage /></AdminLayout>} path="/special-bookings/payment-slip-holds" />
      <Route element={<AdminLayout><PaymentSlipHoldsPage /></AdminLayout>} path="/bookings/payment-slip-holds" />
      <Route element={<AdminLayout><SpecialBookingsAvailability /></AdminLayout>} path="/special-bookings-availability" />
      <Route element={<AdminLayout><Payments /></AdminLayout>} path="/payments" />
      <Route element={<AdminLayout><Dayend /></AdminLayout>} path="/dayend" />
      <Route element={<AdminLayout><SettingsPage /></AdminLayout>} path="/settings" />
      
      {/* Redirect to dashboard */}
      <Route path="*" element={<Navigate to="/dashboard" />} />
    </Routes>
  )
}

export default App
