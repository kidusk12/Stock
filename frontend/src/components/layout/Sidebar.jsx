import { useState, useEffect } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../../features/auth/AuthContext'
import { useTranslation } from 'react-i18next'
import { menuForRole } from '../../config/menu'
import UserAvatar from '../UserAvatar'
import {
  LayoutGrid, Archive, Layers, ShoppingCart, BarChart3, Settings,
  LogOut, Truck, RotateCcw, SlidersHorizontal, Building2, FolderTree,
  Users as UsersIcon, ShieldCheck, UserCog, AlertTriangle, ChevronDown,
  ChevronUp, PackageCheck, X,
} from 'lucide-react'

const ICONS = {
  '/dashboard': LayoutGrid,
  '/products': Archive,
  '/stock': Archive,
  '/sales': Layers,
  '/purchases': ShoppingCart,
  '/reports': BarChart3,
  '/settings': Settings,
  '/transfers': Truck,
  '/returns': RotateCcw,
  '/adjustments': SlidersHorizontal,
  '/low-stock': AlertTriangle,
  '/branches': Building2,
  '/categories': FolderTree,
  '/suppliers': UsersIcon,
  '/users': UserCog,
  '/audit-log': ShieldCheck,
}

const LABEL_KEYS = {
  '/dashboard': 'nav.dashboard',
  '/products': 'nav.products',
  '/stock': 'nav.stock',
  '/sales': 'nav.sales',
  '/purchases': 'nav.purchases',
  '/reports': 'nav.reports',
  '/settings': 'nav.settings',
  '/transfers': 'nav.transfers',
  '/returns': 'nav.returns',
  '/adjustments': 'nav.adjustments',
  '/low-stock': 'nav.lowStock',
  '/branches': 'nav.branches',
  '/categories': 'nav.categories',
  '/suppliers': 'nav.suppliers',
  '/users': 'nav.users',
  '/audit-log': 'nav.auditLog',
}

const PRIMARY_PATHS = ['/dashboard', '/products', '/sales', '/purchases', '/reports']

export default function Sidebar({ mobileOpen = false, onClose }) {
  const { user, logout } = useAuth()
  const { t } = useTranslation()
  const location = useLocation()
  const permittedPaths = new Set(menuForRole(user?.role).map((item) => item.path))
  const primaryItems = PRIMARY_PATHS.filter((path) => permittedPaths.has(path))
  const secondaryItems = [...permittedPaths].filter((path) => !PRIMARY_PATHS.includes(path))
  const displayName = user?.fullName || user?.username || ''

  const isSecondaryActive = secondaryItems.some(
    (path) => location.pathname === path || location.pathname.startsWith(`${path}/`)
  )
  const [showMore, setShowMore] = useState(isSecondaryActive)

  useEffect(() => {
    if (isSecondaryActive) {
      setShowMore(true)
    }
  }, [isSecondaryActive])

  const handleNavClick = () => {
    if (onClose) onClose()
  }

  const renderNavLink = (path, compact = false) => {
    const Icon = ICONS[path] || PackageCheck
    const label = t(LABEL_KEYS[path])

    if (!compact) {
      return (
        <NavLink
          key={path}
          to={path}
          onClick={handleNavClick}
          className={({ isActive }) =>
            `relative flex items-center gap-3.5 pl-4 pr-3 py-2.5 text-xs font-semibold transition-colors duration-150 ${
              isActive
                ? 'bg-[#dee9ee] text-[#173d4a] font-bold rounded-l-2xl rounded-r-none z-10'
                : 'text-[#9cb5c0] hover:text-white hover:bg-[#1f4a59]/60 rounded-xl mr-3.5'
            }`
          }
        >
          {({ isActive }) => (
            <>
              <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="truncate">{label}</span>

              {/* Template-matching smooth concave curves merging into the sidebar */}
              {isActive && (
                <>
                  {/* Top inverted curve */}
                  <div className="absolute -top-4 -right-[1px] w-[17px] h-4 pointer-events-none overflow-hidden z-20">
                    <svg className="w-full h-full text-[#dee9ee]" viewBox="0 0 16 16" fill="currentColor">
                      <path d="M16 0C16 8.837 8.837 16 0 16h16V0z" />
                    </svg>
                  </div>
                  {/* Bottom inverted curve */}
                  <div className="absolute -bottom-4 -right-[1px] w-[17px] h-4 pointer-events-none overflow-hidden z-20">
                    <svg className="w-full h-full text-[#dee9ee]" viewBox="0 0 16 16" fill="currentColor">
                      <path d="M16 16C16 7.163 8.837 0 0 0h16v16z" />
                    </svg>
                  </div>
                </>
              )}
            </>
          )}
        </NavLink>
      )
    }

    return (
      <NavLink
        key={path}
        to={path}
        onClick={handleNavClick}
        className={({ isActive }) =>
          `flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all duration-150 ${
            isActive
              ? 'bg-[#dee9ee] text-[#173d4a] font-bold shadow-xs'
              : 'text-[#9cb5c0] hover:text-white hover:bg-[#1f4a59]/60'
          }`
        }
      >
        <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span className="truncate">{label}</span>
      </NavLink>
    )
  }

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-40 lg:hidden transition-opacity"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar: Slide-over drawer on mobile (< lg), static sidebar on desktop (lg+) */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] bg-[#173d4a] text-[#9cb5c0] h-screen flex flex-col justify-between select-none shadow-2xl transition-transform duration-300 ease-in-out lg:static lg:w-64 lg:shrink-0 lg:shadow-none lg:translate-x-0 lg:z-auto ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div>
          {/* Mobile Drawer Top Bar with Close Button */}
          <div className="flex items-center justify-between pt-4 px-5 pb-1 lg:hidden">
            <span className="text-xs font-bold uppercase tracking-wider text-[#7ea0ad]">
              {t('shell.menu', { defaultValue: 'Menu' })}
            </span>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl text-[#9cb5c0] hover:text-white hover:bg-[#1f4a59] transition cursor-pointer"
              aria-label={t('common.close', { defaultValue: 'Close' })}
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <Link
            to="/profile"
            onClick={handleNavClick}
            className="pt-4 lg:pt-7 pb-5 px-6 flex flex-col items-center text-center group hover:bg-[#1f4a59]/40 rounded-2xl mx-3 mt-2 transition cursor-pointer"
            title={t('shell.profile')}
          >
            <UserAvatar user={user} size="xl" className="group-hover:scale-105 transition-transform" />
            <h2 className="mt-3 text-sm font-bold text-white tracking-tight truncate max-w-full group-hover:text-cyan-200 transition-colors">{displayName}</h2>
            {user?.username && <p className="text-[11px] text-[#7ea0ad] truncate max-w-full mt-0.5">{user.username}</p>}
          </Link>

          <nav
            aria-label={t('shell.primaryNavigation')}
            className="flex flex-col pl-3.5 pr-0 pt-3 pb-3 space-y-1.5 overflow-y-auto max-h-[calc(100vh-270px)] sidebar-nav-scroll"
          >
            {primaryItems.map((path) => renderNavLink(path))}
            {secondaryItems.length > 0 && (
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setShowMore((open) => !open)}
                  aria-expanded={showMore}
                  className="w-[calc(100%-14px)] flex items-center justify-between pl-4 pr-3.5 py-2 text-[11px] font-semibold text-[#9cb5c0] hover:text-white hover:bg-[#1f4a59]/60 rounded-xl transition mr-3.5 cursor-pointer"
                >
                  <span>{t('shell.moreModules')}</span>
                  {showMore ? <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" /> : <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />}
                </button>
                {showMore && (
                  <div className="mt-1 space-y-1 pl-2 border-l border-[#204957] ml-4 mr-3.5">
                    {secondaryItems.map((path) => renderNavLink(path, true))}
                  </div>
                )}
              </div>
            )}
          </nav>
        </div>

        <div className="p-3.5 border-t border-[#204957]">
          <button
            type="button"
            onClick={() => {
              if (onClose) onClose()
              void logout()
            }}
            className="w-full flex items-center gap-3.5 pl-4 pr-3.5 py-2.5 rounded-xl text-xs font-semibold text-[#9cb5c0] hover:text-white hover:bg-[#1f4a59]/60 transition cursor-pointer"
          >
            <LogOut className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{t('auth.logout')}</span>
          </button>
        </div>
      </aside>
    </>
  )
}
