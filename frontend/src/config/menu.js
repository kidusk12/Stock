// Role names must match the backend enum. Confirm the exact values with Kidus and Makda.
export const ROLES = {
  ADMIN: 'ADMIN',
  MANAGER: 'BRANCH_MANAGER',
  STAFF: 'STAFF',
  AUDITOR: 'AUDITOR',
}

const { ADMIN, MANAGER, STAFF, AUDITOR } = ROLES


export const MENU = [
  { path: '/dashboard',   labelKey: 'nav.dashboard',   roles: [ADMIN, MANAGER, STAFF, AUDITOR] },
  { path: '/sales',       labelKey: 'nav.sales',       roles: [ADMIN, MANAGER, STAFF] },
  { path: '/purchases',   labelKey: 'nav.purchases',   roles: [ADMIN, MANAGER, STAFF] },
  { path: '/transfers',   labelKey: 'nav.transfers',   roles: [ADMIN, MANAGER, STAFF] },
  { path: '/adjustments', labelKey: 'nav.adjustments', roles: [ADMIN, MANAGER, STAFF, AUDITOR] },
  { path: '/products',    labelKey: 'nav.products',    roles: [ADMIN, MANAGER, STAFF] },
  { path: '/categories',  labelKey: 'nav.categories',  roles: [ADMIN] },
  { path: '/suppliers',   labelKey: 'nav.suppliers',   roles: [ADMIN, MANAGER] },
  { path: '/branches',    labelKey: 'nav.branches',    roles: [ADMIN] },
  { path: '/low-stock',   labelKey: 'nav.lowStock',    roles: [ADMIN, MANAGER] },
  { path: '/reports',     labelKey: 'nav.reports',     roles: [ADMIN, MANAGER, AUDITOR] },
  { path: '/audit-log',   labelKey: 'nav.auditLog',    roles: [ADMIN, MANAGER, AUDITOR] },
  { path: '/users',       labelKey: 'nav.users',       roles: [ADMIN] },
  { path: '/settings',    labelKey: 'nav.settings',    roles: [ADMIN] },
]

export const menuForRole = (role) => MENU.filter((item) => item.roles.includes(role))