import { useState, useEffect, useCallback, useRef } from 'react'
import { Outlet, Link, useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'
import { useAuth } from '../../features/auth/AuthContext'
import { useTranslation } from 'react-i18next'
import { api } from '../../lib/api'
import LanguageToggle from '../LanguageToggle'
import UserAvatar from '../UserAvatar'
import { toEthiopianDate } from '../../lib/ethiopianDate'
import { errorKey } from '../../lib/errorMessages'
import { Bell, Calendar, AlertTriangle, User, LogOut, Menu } from 'lucide-react'

export default function AppLayout() {
  const { user, selectedBranchId, changeBranch, logout } = useAuth()
  const { t, i18n } = useTranslation()
  const isAm = i18n.language === 'am'
  const [branches, setBranches] = useState([])
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [showNotifs, setShowNotifs] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const notifRef = useRef(null)
  const userMenuRef = useRef(null)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [ethDate, setEthDate] = useState(null)
  const [notificationError, setNotificationError] = useState('')

  const location = useLocation()
  const isDashboard = location.pathname === '/dashboard' || location.pathname === '/'

  // First name extraction for "Welcome [FirstName] !"
  const firstName = user?.fullName?.split(' ')[0] || user?.username || ''
  const canViewNotifications = user?.role === 'ADMIN' || user?.role === 'BRANCH_MANAGER'

  const loadNotifications = useCallback(async () => {
    try {
      const result = await api.get('/notifications', {
        branchId: user?.role === 'ADMIN' ? selectedBranchId || undefined : undefined,
      })
      setNotifications((result.data || []).filter((notification) => !notification.isRead))
      setUnreadCount(result.unreadCount || 0)
      setNotificationError('')
    } catch (error) {
      setNotificationError(t(errorKey(error)))
    }
  }, [selectedBranchId, t, user?.role])

  useEffect(() => {
    setEthDate(toEthiopianDate(new Date()))
    api.get('/branches').then((res) => setBranches(res.data || [])).catch(() => {})

    if (!canViewNotifications) return undefined
    loadNotifications()
    const timer = setInterval(loadNotifications, 60000)
    return () => clearInterval(timer)
  }, [selectedBranchId, canViewNotifications, loadNotifications])

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (notifRef.current && !notifRef.current.contains(event.target)) {
        setShowNotifs(false)
      }
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setShowUserMenu(false)
      }
    }
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setShowNotifs(false)
        setShowUserMenu(false)
        setMobileMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('touchstart', handleClickOutside)
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('touchstart', handleClickOutside)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  const markAllNotificationsRead = async () => {
    try {
      await api.post('/notifications/read-all', {})
      await loadNotifications()
    } catch (error) {
      setNotificationError(t(errorKey(error)))
    }
  }

  const canSwitchBranch = user?.role === 'ADMIN' || user?.role === 'AUDITOR'

  return (
    <div className="flex h-screen overflow-hidden bg-[#dee9ee] text-[#15343f] font-sans antialiased">
      <Sidebar mobileOpen={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />

      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Top Header matching reference image: "Welcome [Name] !", Ethiopian Date, Branch Switcher, Language, Notifs, Avatar */}
        <header className="h-16 px-4 sm:px-6 md:px-8 flex items-center justify-between border-b border-[#cfdde3]/80 bg-[#dee9ee]/80 backdrop-blur-md sticky top-0 z-30">
          <div className="flex items-center gap-2 sm:gap-4 min-w-0">
            {/* Mobile Hamburger Menu Toggle */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/90 border border-[#cadbe2] text-[#15343f] hover:bg-slate-50 transition shadow-2xs cursor-pointer"
              aria-label={t('shell.openMenu', { defaultValue: 'Open menu' })}
            >
              <Menu className="h-5 w-5" />
            </button>

            {isDashboard && (
              <h1 className="text-xl sm:text-2xl font-bold text-[#15343f] tracking-tight whitespace-nowrap">
                {t('shell.welcome', { name: firstName })}
              </h1>
            )}
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2.5 md:gap-3 shrink-0">
            {/* Ethiopian Date Badge: visible on sm+ screens to preserve mobile header space */}
            <div className="hidden sm:flex items-center gap-1.5 rounded-full bg-white/90 border border-[#cadbe2] px-3.5 py-1.5 text-[11px] font-bold text-[#15343f] shadow-2xs">
              <Calendar className="h-3.5 w-3.5 text-[#173d4a]" />
              <span className="whitespace-nowrap">{isAm ? ethDate?.formattedAm : ethDate?.formattedEn}</span>
            </div>

            {/* Branch Switcher with responsive max-width */}
            <div className="flex items-center">
              {canSwitchBranch ? (
                <select
                  value={selectedBranchId || ''}
                  onChange={(e) => changeBranch(e.target.value ? Number(e.target.value) : null)}
                  className="max-w-[100px] sm:max-w-[140px] md:max-w-none rounded-full border border-[#cadbe2] bg-white/90 px-2.5 sm:px-3 py-1.5 text-[11px] font-semibold text-[#15343f] shadow-2xs focus:outline-none cursor-pointer truncate"
                >
                  <option value="">{t('common.allBranches')}</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              ) : (
                <span className="max-w-[100px] sm:max-w-[140px] md:max-w-none rounded-full bg-white/90 border border-[#cadbe2] px-2.5 sm:px-3 py-1.5 text-[11px] font-bold text-[#15343f] shadow-2xs truncate">
                  {user?.branchName || t('shell.noBranchAssigned')}
                </span>
              )}
            </div>

            {/* Language Toggle */}
            <LanguageToggle />

            {/* Notifications */}
            {canViewNotifications && (
              <div className="relative" ref={notifRef}>
                <button
                  type="button"
                  onClick={() => {
                    const willOpen = !showNotifs
                    setShowNotifs(willOpen)
                    if (willOpen) loadNotifications()
                  }}
                  className="relative grid h-8 w-8 place-items-center rounded-full bg-white border border-[#cadbe2] text-[#15343f] hover:bg-slate-50 transition shadow-2xs cursor-pointer"
                  aria-label={t('shell.notifications')}
                  aria-expanded={showNotifs}
                  aria-controls="notification-list"
                  aria-haspopup="dialog"
                >
                  <Bell className="h-4 w-4 text-[#15343f]" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[#c66749] text-[8px] font-bold text-white shadow-2xs">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                </button>

                {/* Notification dropdown */}
                {showNotifs && (
                  <div
                    id="notification-list"
                    role="dialog"
                    aria-labelledby="notification-heading"
                    className="absolute right-0 mt-2 w-[calc(100vw-2rem)] max-w-sm sm:w-96 rounded-2xl border border-[#cfdde3] bg-white p-4 shadow-xl z-50"
                  >
                    <div className="flex items-center justify-between border-b border-[#e2edf2] pb-2">
                      <span id="notification-heading" className="font-bold text-xs text-[#15343f]">
                        {t('shell.notifications')} ({unreadCount})
                      </span>
                      {unreadCount > 0 && (
                        <button
                          type="button"
                          onClick={markAllNotificationsRead}
                          className="text-[11px] text-[#4f7988] font-semibold hover:underline cursor-pointer"
                        >
                          {t('shell.markAllRead')}
                        </button>
                      )}
                    </div>

                    <div className="mt-2 max-h-72 overflow-y-auto divide-y divide-[#edf3f6] text-xs">
                      {notificationError && (
                        <p role="alert" className="py-2 text-red-700">
                          {notificationError}{' '}
                          <button
                            type="button"
                            onClick={loadNotifications}
                            className="font-bold underline cursor-pointer"
                          >
                            {t('common.retry')}
                          </button>
                        </p>
                      )}
                      {notifications.length === 0 ? (
                        <div className="py-6 text-center text-slate-400">
                          {t('shell.noNotifications')}
                        </div>
                      ) : (
                        notifications.map((n) => (
                          <div
                            key={n.id}
                            className={`py-2.5 px-2 flex items-start gap-2.5 ${
                              !n.isRead ? 'bg-[#fbece5]/60 rounded-xl font-medium' : ''
                            }`}
                          >
                            <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[#fbece5] text-[#c66749]">
                              <AlertTriangle className="h-3 w-3" />
                            </span>
                            <div className="flex-1">
                              <p className="text-[#15343f]">
                                {t('shell.lowStockNotification', {
                                  product: n.productName,
                                  branch: n.branchName,
                                  quantity: n.quantity ?? n.currentStock,
                                  minimum: n.minQuantity,
                                })}
                              </p>
                              <span className="text-[10px] text-slate-400">
                                {new Intl.DateTimeFormat(
                                  i18n.language === 'am' ? 'am-ET' : 'en-ET',
                                  {
                                    timeZone: 'Africa/Addis_Ababa',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  }
                                ).format(new Date(n.createdAt))}
                              </span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* User Avatar Menu Dropdown */}
            <div className="relative pl-1" ref={userMenuRef}>
              <button
                type="button"
                onClick={() => {
                  setShowUserMenu((prev) => !prev)
                  setShowNotifs(false)
                }}
                className="flex items-center group cursor-pointer focus:outline-none"
                aria-expanded={showUserMenu}
                aria-haspopup="menu"
                aria-label={t('shell.profile')}
              >
                <UserAvatar
                  user={user}
                  size="sm"
                  className={`transition-all shadow-xs ${
                    showUserMenu ? 'ring-2 ring-[#173d4a]' : 'group-hover:ring-2 group-hover:ring-[#173d4a]'
                  }`}
                />
              </button>

              {showUserMenu && (
                <div
                  role="menu"
                  className="absolute right-0 mt-2 w-48 rounded-2xl border border-[#cfdde3] bg-white p-1.5 shadow-xl z-50"
                >
                  <div className="px-3 py-2 border-b border-[#edf3f6] mb-1">
                    <div className="text-xs font-bold text-[#15343f] truncate">
                      {user?.fullName || user?.username}
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono truncate">
                      {user?.role}
                    </div>
                  </div>

                  <Link
                    to="/profile"
                    role="menuitem"
                    onClick={() => setShowUserMenu(false)}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-[#15343f] hover:bg-[#edf3f6] transition cursor-pointer"
                  >
                    <User className="h-3.5 w-3.5 text-[#4f7988]" />
                    <span>{t('shell.profileOption', { defaultValue: 'Profile' })}</span>
                  </Link>

                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setShowUserMenu(false)
                      void logout()
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-[#c66749] hover:bg-[#fbece5]/60 transition cursor-pointer text-left"
                  >
                    <LogOut className="h-3.5 w-3.5 text-[#c66749]" />
                    <span>{t('auth.logout', { defaultValue: 'Log out' })}</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Main Content Area with Canvas background #dee9ee and responsive padding */}
        <main className="flex-1 p-3.5 sm:p-6 md:p-8 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
