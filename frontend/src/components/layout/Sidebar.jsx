import { useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { useAuth } from '../../features/auth/AuthContext'
import { useTranslation } from 'react-i18next'
import { menuForRole } from '../../config/menu'
import UserAvatar from '../UserAvatar'
import {
  LayoutGrid, Archive, Layers, ShoppingCart, BarChart3, Settings,
  LogOut, Truck, RotateCcw, SlidersHorizontal, Building2, FolderTree,
  Users as UsersIcon, ShieldCheck, UserCog, AlertTriangle, ChevronDown,
  ChevronUp, PackageCheck,
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

export default function Sidebar() {
  const { user, logout } = useAuth()
  const { t } = useTranslation()
  const [showMore, setShowMore] = useState(false)
  const permittedPaths = new Set(menuForRole(user?.role).map((item) => item.path))
  const primaryItems = PRIMARY_PATHS.filter((path) => permittedPaths.has(path))
  const secondaryItems = [...permittedPaths].filter((path) => !PRIMARY_PATHS.includes(path))
  const displayName = user?.fullName || user?.username || ''

  const renderNavLink = (path, compact = false) => {
    const Icon = ICONS[path] || PackageCheck
    return (
      <NavLink
        key={path}
        to={path}
        className={({ isActive }) => `flex items-center gap-3.5 ${compact ? 'px-3 py-2 rounded-lg' : 'px-4 py-2.5 rounded-xl'} text-xs font-semibold transition-all duration-150 ${isActive ? 'bg-[#dee9ee] text-[#173d4a] font-bold shadow-xs' : 'text-[#9cb5c0] hover:text-white hover:bg-[#1f4a59]'}`}
      >
        <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span className="truncate">{t(LABEL_KEYS[path])}</span>
      </NavLink>
    )
  }

  return (
    <aside className="w-64 shrink-0 bg-[#173d4a] text-[#9cb5c0] h-screen flex flex-col justify-between select-none sticky top-0">
      <div>
        <Link to="/profile" className="pt-7 pb-5 px-6 flex flex-col items-center text-center group hover:bg-[#1f4a59]/40 rounded-2xl mx-3 mt-2 transition" title={t('shell.profile')}>
          <UserAvatar user={user} size="xl" className="group-hover:scale-105 transition-transform" />
          <h2 className="mt-3 text-sm font-bold text-white tracking-tight truncate max-w-full group-hover:text-cyan-200 transition-colors">{displayName}</h2>
          {user?.username && <p className="text-[11px] text-[#7ea0ad] truncate max-w-full mt-0.5">{user.username}</p>}
        </Link>

        <nav aria-label={t('shell.primaryNavigation')} className="px-4 space-y-1.5 overflow-y-auto max-h-[calc(100vh-250px)]">
          {primaryItems.map((path) => renderNavLink(path))}
          {secondaryItems.length > 0 && (
            <div className="pt-2">
              <button type="button" onClick={() => setShowMore((open) => !open)} aria-expanded={showMore} className="w-full flex items-center justify-between px-4 py-2 text-[11px] font-semibold text-[#9cb5c0] hover:text-white hover:bg-[#1f4a59]/60 rounded-xl transition">
                <span>{t('shell.moreModules')}</span>
                {showMore ? <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" /> : <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />}
              </button>
              {showMore && <div className="mt-1 space-y-1 pl-2 border-l border-[#204957] ml-2">{secondaryItems.map((path) => renderNavLink(path, true))}</div>}
            </div>
          )}
        </nav>
      </div>

      <div className="p-4 border-t border-[#204957]">
        <button type="button" onClick={() => { void logout() }} className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-semibold text-[#9cb5c0] hover:text-white hover:bg-[#1f4a59] transition">
          <LogOut className="h-4 w-4" aria-hidden="true" />
          <span>{t('auth.logout')}</span>
        </button>
      </div>
    </aside>
  )
}
