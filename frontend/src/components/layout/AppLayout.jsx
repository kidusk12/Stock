import { Outlet, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { AlertTriangle, Bell } from 'lucide-react'
import Sidebar from './Sidebar'
import { useAuth } from '../../features/auth/AuthContext'
import { useTranslation } from 'react-i18next'
import LanguageToggle from '../LanguageToggle'
import { formatNow } from '../../lib/dateFormat'
import { api } from '../../lib/api'

export default function AppLayout() {
  const { user, logout, selectedBranchId } = useAuth()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [showNotifications, setShowNotifications] = useState(false)
  const canSeeNotifications = user?.role === 'ADMIN' || user?.role === 'BRANCH_MANAGER'

  useEffect(() => {
    if (!canSeeNotifications) return undefined
    let active = true
    const load = () => api.get('/notifications', { branchId: selectedBranchId, limit: 20 })
      .then((data) => { if (active) { setNotifications(data.data || []); setUnreadCount(data.unreadCount || 0) } })
      .catch(() => {})
    load()
    const timer = window.setInterval(load, 60000)
    return () => { active = false; window.clearInterval(timer) }
  }, [canSeeNotifications, selectedBranchId])

  const markNotificationRead = async (id) => {
    try {
      await api.post(`/notifications/${id}/read`)
      const wasUnread = notifications.find((row) => row.id === id)?.isRead === false
      setNotifications((rows) => rows.map((row) => row.id === id ? { ...row, isRead: true } : row))
      if (wasUnread) setUnreadCount((count) => Math.max(0, count - 1))
    } catch {}
  }
  const markAllRead = async () => {
    try {
      await api.post(`/notifications/read-all${selectedBranchId ? `?branchId=${selectedBranchId}` : ''}`)
      setNotifications((rows) => rows.map((row) => ({ ...row, isRead: true })))
      setUnreadCount(0)
    } catch {}
  }

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 bg-white border-b flex items-center justify-end gap-4 px-6">
          <span className="text-sm text-gray-500 mr-auto">{formatNow(t)}</span>
          <LanguageToggle />
          {canSeeNotifications && <div className="relative">
            <button type="button" onClick={() => setShowNotifications((shown) => !shown)} aria-label={t('lowStock.title')} className="relative rounded p-2 hover:bg-slate-100">
              <Bell size={18} />{unreadCount > 0 && <span className="absolute -right-0.5 -top-0.5 min-w-4 rounded-full bg-red-600 px-1 text-[10px] text-white">{unreadCount}</span>}
            </button>
            {showNotifications && <div className="absolute right-0 z-50 mt-2 w-80 rounded-xl border bg-white p-3 shadow-xl">
              <div className="mb-2 flex items-center justify-between border-b pb-2 text-sm font-semibold"><span>{t('lowStock.title')}</span>
                {unreadCount > 0 && <button type="button" onClick={markAllRead} className="text-xs text-blue-700">{t('notifications.markAllRead', 'Mark all read')}</button>}</div>
              <div className="max-h-80 divide-y overflow-auto">
                {notifications.length === 0 ? <p className="py-5 text-center text-sm text-slate-500">{t('common.noData')}</p> : notifications.map((row) => <button type="button" key={row.id} onClick={() => markNotificationRead(row.id)} className={`flex w-full gap-2 py-2 text-left text-xs ${row.isRead ? 'text-slate-500' : 'font-semibold text-slate-900'}`}>
                  <AlertTriangle size={15} className="mt-0.5 shrink-0 text-amber-600" /><span>{row.productName} · {row.branchName}: {row.quantity} / {row.minQuantity}</span>
                </button>)}
              </div>
            </div>}
          </div>}
          <span className="text-sm text-gray-600">{user.fullName} · {user.role}</span>
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
