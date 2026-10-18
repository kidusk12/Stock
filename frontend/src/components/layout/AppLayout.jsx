import { useState, useEffect } from 'react'
import { Outlet, Link } from 'react-router-dom'
import Sidebar from './Sidebar'
import { useAuth } from '../../features/auth/AuthContext'
import { useTranslation } from 'react-i18next'
import { api } from '../../lib/api'
import LanguageToggle from '../LanguageToggle'
import UserAvatar from '../UserAvatar'
import { toEthiopianDate } from '../../lib/ethiopianDate'
import {
  Bell,
  Building2,
  Calendar,
  Search,
  Moon,
  Sun,
  AlertTriangle,
  Barcode
} from 'lucide-react'

export default function AppLayout() {
  const { user, selectedBranchId, changeBranch } = useAuth()
  const { t, i18n } = useTranslation()
  const isAm = i18n.language === 'am'

  const [branches, setBranches] = useState([])
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [showNotifs, setShowNotifs] = useState(false)
  const [ethDate, setEthDate] = useState(null)
  const [globalSearch, setGlobalSearch] = useState('')

  // First name extraction for "Welcome [FirstName] !"
  const rawName = user?.fullName ? user.fullName.split(' ')[0] : 'Nirmal'
  const firstName = isAm ? (user?.fullNameAm?.split(' ')[0] || 'አበበ') : rawName

  useEffect(() => {
    setEthDate(toEthiopianDate(new Date()))

    api.get('/branches').then((res) => {
      setBranches(res.data || [])
    }).catch(() => {})

    loadNotifications()
    const timer = setInterval(loadNotifications, 15000)
    return () => clearInterval(timer)
  }, [selectedBranchId])

  const loadNotifications = () => {
    api.get('/notifications').then((res) => {
      setNotifications(res.data || [])
      setUnreadCount(res.unreadCount || 0)
    }).catch(() => {})
  }

  const markAllNotificationsRead = async () => {
    try {
      await api.patch('/notifications/read-all')
      setUnreadCount(0)
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })))
    } catch {}
  }

  const canSwitchBranch = user?.role === 'ADMIN' || user?.role === 'AUDITOR'

  return (
    <div className="flex h-screen overflow-hidden bg-[#dee9ee] text-[#15343f] font-sans antialiased">
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Top Header matching reference image: "Welcome [Name] !", Search Pill, Controls */}
        <header className="h-20 px-6 sm:px-8 shrink-0 flex items-center justify-between gap-4 border-b border-[#cfdde3]/70 bg-[#dee9ee]">
          {/* Left: Welcome Title */}
          <div className="shrink-0">
            <h1
              className="text-xl sm:text-2xl font-bold text-[#15343f] tracking-tight"
              style={{ whiteSpace: 'nowrap' }}
            >
              {isAm ? `እንኳን ደህና መጡ ${firstName} !` : `Welcome ${firstName} !`}
            </h1>
          </div>

          {/* Right Section: Pill Search, Ethiopian Date, Branch Dropdown, Theme & Notifications */}
          <div className="flex items-center gap-2.5 sm:gap-3">
            {/* Search Pill Input matching reference image */}
            <div className="relative hidden md:block w-48 lg:w-64">
              <input
                type="text"
                value={globalSearch}
                onChange={(e) => setGlobalSearch(e.target.value)}
                placeholder="Search"
                className="w-full rounded-full border border-[#cadbe2] bg-white pl-4 pr-10 py-1.5 text-xs text-[#15343f] placeholder-[#8da2ac] focus:border-[#4f7988] focus:outline-none shadow-2xs"
              />
              <Search className="absolute right-3 top-2 h-4 w-4 text-[#8da2ac] pointer-events-none" />
            </div>

            {/* Ethiopian Date Badge */}
            <div className="hidden xl:flex items-center gap-1.5 rounded-full bg-white/90 border border-[#cadbe2] px-3 py-1.5 text-[11px] font-semibold text-[#15343f] shadow-2xs">
              <Calendar className="h-3.5 w-3.5 text-[#4f7988]" />
              <span className="whitespace-nowrap">{isAm ? ethDate?.formattedAm : ethDate?.formattedEn}</span>
            </div>

            {/* Branch Switcher */}
            <div className="flex items-center">
              {canSwitchBranch ? (
                <select
                  value={selectedBranchId || ''}
                  onChange={(e) => changeBranch(e.target.value ? Number(e.target.value) : null)}
                  className="rounded-full border border-[#cadbe2] bg-white/90 px-3 py-1.5 text-[11px] font-semibold text-[#15343f] shadow-2xs focus:outline-none cursor-pointer"
                >
                  <option value="">{t('common.allBranches')}</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              ) : (
                <span className="rounded-full bg-white/90 border border-[#cadbe2] px-3 py-1.5 text-[11px] font-bold text-[#15343f] shadow-2xs">
                  {user?.branchName || 'Bole Branch'}
                </span>
              )}
            </div>

            {/* Language Toggle */}
            <LanguageToggle />

            {/* Dark Mode / Pill toggle mock matching screenshot */}
            <div className="flex items-center rounded-full bg-[#173d4a] px-2 py-1 text-white shadow-2xs gap-1.5 cursor-pointer hover:bg-[#1f4a59] transition">
              <Moon className="h-3 w-3 text-cyan-200" />
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-300" />
            </div>

            {/* Notification Bell matching screenshot */}
            <div className="relative">
              <button
                onClick={() => setShowNotifs(!showNotifs)}
                className="relative grid h-8 w-8 place-items-center rounded-full bg-white border border-[#cadbe2] text-[#15343f] hover:bg-slate-50 transition shadow-2xs"
                aria-label="Notifications"
              >
                <Bell className="h-4 w-4 text-[#15343f]" />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[#c66749] text-[8px] font-bold text-white shadow-2xs">
                    {unreadCount}
                  </span>
                )}
              </button>

              {/* Notification dropdown */}
              {showNotifs && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl border border-[#cfdde3] bg-white p-4 shadow-xl z-50">
                  <div className="flex items-center justify-between border-b border-[#e2edf2] pb-2">
                    <span className="font-bold text-xs text-[#15343f]">
                      {t('lowStock.title')} ({notifications.length})
                    </span>
                    {unreadCount > 0 && (
                      <button
                        onClick={markAllNotificationsRead}
                        className="text-[11px] text-[#4f7988] font-semibold hover:underline"
                      >
                        {isAm ? 'ሁሉንም እንዳነበብኩ ምልክት አድርግ' : 'Mark all read'}
                      </button>
                    )}
                  </div>

                  <div className="mt-2 max-h-72 overflow-y-auto divide-y divide-[#edf3f6] text-xs">
                    {notifications.length === 0 ? (
                      <div className="py-6 text-center text-slate-400">
                        {isAm ? 'ምንም ማሳወቂያ የለም' : 'No notifications'}
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
                            <p className="text-[#15343f]">{n.message}</p>
                            <span className="text-[10px] text-slate-400">
                              {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Quick Profile Link in Header */}
            <Link
              to="/profile"
              className="flex items-center pl-1 group cursor-pointer"
              title={isAm ? 'የእኔ መገለጫ' : 'My Profile'}
            >
              <UserAvatar
                user={user}
                size="sm"
                className="group-hover:ring-2 group-hover:ring-[#173d4a] transition-all shadow-xs"
              />
            </Link>
          </div>
        </header>

        {/* Main Content Area with Canvas background #dee9ee */}
        <main className="flex-1 p-6 md:p-8 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}