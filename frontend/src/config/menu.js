export const ROLES = {
  ADMIN: 'ADMIN',
  MANAGER: 'BRANCH_MANAGER',
  STAFF: 'STAFF',
  AUDITOR: 'AUDITOR',
}

const { ADMIN, MANAGER, STAFF, AUDITOR } = ROLES

export const MENU = [
  { path: '/dashboard',   labelKey: 'nav.dashboard',   icon: 'LayoutDashboard', roles: [ADMIN, MANAGER, STAFF, AUDITOR] },
  { path: '/sales',       labelKey: 'nav.sales',       icon: 'ShoppingCart',   roles: [ADMIN, MANAGER, STAFF] },
  { path: '/returns',     labelKey: 'nav.returns',     icon: 'RotateCcw',      roles: [ADMIN, MANAGER, STAFF] },
  { path: '/purchases',   labelKey: 'nav.purchases',   icon: 'PackageCheck',   roles: [ADMIN, MANAGER, STAFF] },
  { path: '/transfers',   labelKey: 'nav.transfers',   icon: 'Truck',          roles: [ADMIN, MANAGER, STAFF] },
  { path: '/adjustments', labelKey: 'nav.adjustments', icon: 'SlidersHorizontal', roles: [ADMIN, MANAGER, STAFF, AUDITOR] },
  { path: '/products',    labelKey: 'nav.products',    icon: 'Boxes',          roles: [ADMIN, MANAGER, STAFF, AUDITOR] },
  { path: '/categories',  labelKey: 'nav.categories',  icon: 'FolderTree',     roles: [ADMIN] },
  { path: '/suppliers',   labelKey: 'nav.suppliers',   icon: 'Users',          roles: [ADMIN, MANAGER] },
  { path: '/branches',    labelKey: 'nav.branches',    icon: 'Building2',      roles: [ADMIN] },
  { path: '/low-stock',   labelKey: 'nav.lowStock',    icon: 'AlertTriangle',  roles: [ADMIN, MANAGER] },
  { path: '/reports',     labelKey: 'nav.reports',     icon: 'BarChart3',      roles: [ADMIN, MANAGER, AUDITOR] },
  { path: '/audit-log',   labelKey: 'nav.auditLog',    icon: 'ShieldCheck',    roles: [ADMIN, MANAGER, AUDITOR] },
  { path: '/users',       labelKey: 'nav.users',       icon: 'UserCog',        roles: [ADMIN] },
  { path: '/settings',    labelKey: 'nav.settings',    icon: 'Settings',       roles: [ADMIN] },
]

export const menuForRole = (role) => MENU.filter((item) => item.roles.includes(role))