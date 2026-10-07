import { NavLink } from 'react-router-dom'
import { useAuth } from '../../features/auth/AuthContext'
import { menuForRole } from '../../config/menu'
import { t } from '../../i18n/temp'

export default function Sidebar() {
  const { user } = useAuth()
  const items = menuForRole(user.role)

  return (
    <aside className="w-60 shrink-0 bg-brand text-white min-h-screen flex flex-col">
      <div className="px-5 py-4 text-lg font-bold border-b border-white/20">{t('app.name')}</div>
      <nav className="flex-1 overflow-y-auto py-2">
        {items.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `block px-5 py-2.5 text-sm hover:bg-white/10 ${isActive ? 'bg-white/20 font-semibold' : ''}`
            }
          >
            {t(item.labelKey)}
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}