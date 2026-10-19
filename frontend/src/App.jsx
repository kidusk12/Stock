import { Routes, Route, Navigate } from 'react-router-dom'
import ProtectedRoute from './components/ProtectedRoute'
import AppLayout from './components/layout/AppLayout'
import Login from './features/auth/Login'
import Placeholder from './components/Placeholder'
import { MENU } from './config/menu'
import DateDemo from './features/dev/DateDemo'
import Sales from './features/sales/Sales'

// Real screens. Everything in MENU that is not listed here still shows a Placeholder.
const SCREENS = {
  '/sales': Sales,
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
        {MENU.map((item) => {
          const Screen = SCREENS[item.path]
          return (
            <Route
              key={item.path}
              path={item.path}
              element={
                <ProtectedRoute roles={item.roles}>
                  {Screen ? <Screen /> : <Placeholder titleKey={item.labelKey} />}
                </ProtectedRoute>
              }
            />
          )
        })}

        {import.meta.env.DEV && <Route path="/dev/dates" element={<DateDemo />} />}
      </Route>

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}