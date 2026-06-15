import { Route, Routes, Navigate } from "react-router-dom"
import Login from "./pages/login"
import Members from "./pages/members"
import Trainers from "./pages/trainers"
import Payments from "./pages/payments"
import Reports from "./pages/reports"
import SettingsPage from "./pages/settings"
import AdminLayout from "./layouts/admin-layout"
import Dayend from "./pages/dayend"
import Daypass from "./pages/daypass"

function App() {
  return (
    <Routes>
      <Route path="/" element={<Login />} />
      
      {/* Admin Dashboard Routes */}
      <Route element={<AdminLayout><Members /></AdminLayout>} path="/members" />
      <Route element={<AdminLayout><Trainers /></AdminLayout>} path="/trainers" />
      <Route element={<AdminLayout><Daypass /></AdminLayout>} path="/daypass" />
      <Route element={<AdminLayout><Payments /></AdminLayout>} path="/payments" />
      <Route element={<AdminLayout><Dayend /></AdminLayout>} path="/dayend" />
      <Route element={<AdminLayout><Reports /></AdminLayout>} path="/reports" />
      <Route element={<AdminLayout><SettingsPage /></AdminLayout>} path="/settings" />
      
      {/* Redirect to dashboard */}
      <Route path="*" element={<Navigate to="/dashboard" />} />
    </Routes>
  )
}

export default App
