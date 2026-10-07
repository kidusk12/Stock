import { Outlet, useNavigate } from 'react-router-dom'
import Sidebar from './Sidebar'
import { useAuth } from '../../features/auth/AuthContext'
import { t } from '../../i18n/temp'

export default function AppLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 bg-white border-b flex items-center justify-end gap-4 px-6">
          {/* Language toggle (step 2) and notification bell (Week 2) go here */}
          <span className="text-sm text-gray-600">{user.name} · {user.role}</span>
          <button onClick={handleLogout} className="text-sm text-brand hover:underline">
            {t('auth.logout')}
          </button>
        </header>
        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}