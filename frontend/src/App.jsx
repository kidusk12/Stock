import { Routes, Route, Navigate } from 'react-router-dom'
import ProtectedRoute from './components/ProtectedRoute'
import AppLayout from './components/layout/AppLayout'
import Login from './features/auth/Login'
import Placeholder from './components/Placeholder'
import { MENU } from './config/menu'
import DateDemo from './features/dev/DateDemo'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
        {MENU.map((item) => (
          <Route
            key={item.path}
            path={item.path}
            element={
              <ProtectedRoute roles={item.roles}>
                <Placeholder titleKey={item.labelKey} />
              </ProtectedRoute>
            }
          />
        ))}

        {import.meta.env.DEV && <Route path="/dev/dates" element={<DateDemo />} />}
      </Route>

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}