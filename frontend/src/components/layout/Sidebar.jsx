import { useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { useAuth } from '../../features/auth/AuthContext'
import { useTranslation } from 'react-i18next'
import UserAvatar from '../UserAvatar'
import {
  LayoutGrid,
  Boxes,
  Archive,
  Layers,
  ShoppingCart,
  BarChart3,
  HelpCircle,
  Settings,
  LogOut,
  Truck,
  RotateCcw,
  SlidersHorizontal,
  Building2,
  FolderTree,
  Users as UsersIcon,
  ShieldCheck,
  UserCog,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  User
} from 'lucide-react'

export default function Sidebar() {
  const { user, logout } = useAuth()
  const { t, i18n } = useTranslation()
  const isAm = i18n.language === 'am'
  const [showMore, setShowMore] = useState(false)

  // Primary menu items matching the reference screenshot exactly
  const primaryItems = [
    {
      path: '/dashboard',
      label: isAm ? 'ዳሽቦርድ' : 'Dashboard',
      icon: LayoutGrid,
    },
    {
      path: '/products',
      label: isAm ? 'ክምችት / ምርቶች' : 'Inventory',
      icon: Archive,
    },
    {
      path: '/sales',
      label: isAm ? 'ትዕዛዞች / POS' : 'Orders',
      icon: Layers,
    },
    {
      path: '/purchases',
      label: isAm ? 'ግዥዎች' : 'Purchase',
      icon: ShoppingCart,
    },
    {
      path: '/reports',
      label: isAm ? 'ሪፖርቶች' : 'Reporting',
      icon: BarChart3,
    },
    {
      path: '/profile',
      label: isAm ? 'መገለጫ' : 'Profile',
      icon: User,
    },
    {
      path: '/settings',
      label: isAm ? 'ማስተካከያዎች' : 'Settings',
      icon: Settings,
    },
  ]

  // Secondary management items for SRS features (collapsible to keep screenshot neatness)
  const secondaryItems = [
    { path: '/transfers', label: isAm ? 'የቅርንጫፍ ዝውውር' : 'Transfers', icon: Truck },
    { path: '/returns', label: isAm ? 'ተመላሾች' : 'Returns', icon: RotateCcw },
    { path: '/adjustments', label: isAm ? 'የክምችት ማስተካከያ' : 'Adjustments', icon: SlidersHorizontal },
    { path: '/low-stock', label: isAm ? 'ዝቅተኛ ክምችት' : 'Low Stock', icon: AlertTriangle },
    { path: '/branches', label: isAm ? 'ቅርንጫፎች' : 'Branches', icon: Building2 },
    { path: '/categories', label: isAm ? 'ምድቦች' : 'Categories', icon: FolderTree },
    { path: '/suppliers', label: isAm ? 'አቅራቢዎች' : 'Suppliers', icon: UsersIcon },
    { path: '/users', label: isAm ? 'ተጠቃሚዎች' : 'Users', icon: UserCog },
    { path: '/audit-log', label: isAm ? 'የኦዲት መዝገብ' : 'Audit Log', icon: ShieldCheck },
  ]

  const cleanEnName = user?.fullName ? user.fullName.split('(')[0].trim() : 'Abebe Kebede'
  const displayName = isAm ? (user?.fullNameAm || 'አበበ ከበደ') : cleanEnName
  const displayEmail = user?.email || (user?.username ? `${user.username}@berhanstock.et` : 'admin@berhanstock.et')

  return (
    <aside className="w-64 shrink-0 bg-[#173d4a] text-[#9cb5c0] h-screen flex flex-col justify-between select-none sticky top-0">
      <div>
        {/* Profile Card at Top (clicking navigates to /profile) */}
        <Link
          to="/profile"
          className="pt-7 pb-5 px-6 flex flex-col items-center text-center group cursor-pointer hover:bg-[#1f4a59]/40 rounded-2xl mx-3 mt-2 transition"
          title={isAm ? 'መገለጫዎን ይመልከቱ እና ያርትዑ' : 'View & edit your profile'}
        >
          <div className="relative">
            <UserAvatar user={user} size="xl" className="group-hover:scale-105 transition-transform" />
          </div>
          <h2 className="mt-3 text-sm font-bold text-white tracking-tight truncate max-w-full group-hover:text-cyan-200 transition-colors">
            {displayName}
          </h2>
          <p className="text-[11px] text-[#7ea0ad] truncate max-w-full font-sans mt-0.5">
            {displayEmail}
          </p>
        </Link>

        {/* Navigation items list */}
        <nav className="px-4 space-y-1.5 overflow-y-auto max-h-[calc(100vh-250px)]">
          {primaryItems.map((item) => {
            const Icon = item.icon
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  `flex items-center gap-3.5 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all duration-150 ${
                    isActive
                      ? 'bg-[#dee9ee] text-[#173d4a] font-bold shadow-xs'
                      : 'text-[#9cb5c0] hover:text-white hover:bg-[#1f4a59]'
                  }`
                }
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </NavLink>
            )
          })}

          {/* Collapsible More / Management Items */}
          <div className="pt-2">
            <button
              onClick={() => setShowMore(!showMore)}
              className="w-full flex items-center justify-between px-4 py-2 text-[11px] font-semibold text-[#6f909e] hover:text-white hover:bg-[#1f4a59]/60 rounded-xl transition"
            >
              <span>{isAm ? 'ተጨማሪ ክፍሎች' : 'More Modules'}</span>
              {showMore ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </button>

            {showMore && (
              <div className="mt-1 space-y-1 pl-2 border-l border-[#204957] ml-2">
                {secondaryItems.map((item) => {
                  const Icon = item.icon
                  return (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      className={({ isActive }) =>
                        `flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition ${
                          isActive
                            ? 'bg-[#dee9ee] text-[#173d4a] font-bold shadow-xs'
                            : 'text-[#8caab7] hover:text-white hover:bg-[#1f4a59]'
                        }`
                      }
                    >
                      <Icon className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </NavLink>
                  )
                })}
              </div>
            )}
          </div>
        </nav>
      </div>

      {/* Logout button at bottom (matching reference image) */}
      <div className="p-4 border-t border-[#204957]">
        <button
          onClick={logout}
          className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-semibold text-[#9cb5c0] hover:text-white hover:bg-[#1f4a59] transition"
        >
          <LogOut className="h-4 w-4" />
          <span>{isAm ? 'ውጣ' : 'Logout'}</span>
        </button>
      </div>
    </aside>
  )
}