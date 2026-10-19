import { Routes, Route, Navigate } from 'react-router-dom'
import ProtectedRoute from './components/ProtectedRoute'
import AppLayout from './components/layout/AppLayout'
import LandingPage from './features/landing/LandingPage'
import Login from './features/auth/Login'
import Dashboard from './features/dashboard/Dashboard'
import StockList from './features/stock/StockList'
import ProductsList from './features/products/ProductsList'
import SalesPos from './features/sales/Sales'
import ReturnsList from './features/returns/ReturnsList'
import PurchasesList from './features/purchases/PurchasesList'
import TransfersList from './features/transfers/TransfersList'
import AdjustmentsList from './features/adjustments/AdjustmentsList'
import CategoriesList from './features/categories/CategoriesList'
import SuppliersList from './features/suppliers/SuppliersList'
import BranchesList from './features/branches/BranchesList'
import LowStockList from './features/lowStock/LowStockList'
import ReportsView from './features/reports/ReportsView'
import AuditLogList from './features/audit/AuditLogList'
import UsersList from './features/users/UsersList'
import SettingsView from './features/settings/SettingsView'
import { ROLES } from './config/menu'

const screens = {
  '/dashboard': [Dashboard, [ROLES.ADMIN, ROLES.MANAGER, ROLES.STAFF, ROLES.AUDITOR]],
  '/stock': [StockList, [ROLES.ADMIN, ROLES.MANAGER, ROLES.STAFF, ROLES.AUDITOR]],
  '/products': [ProductsList, [ROLES.ADMIN, ROLES.MANAGER, ROLES.STAFF, ROLES.AUDITOR]],
  '/sales': [SalesPos, [ROLES.ADMIN, ROLES.MANAGER, ROLES.STAFF]],
  '/returns': [ReturnsList, [ROLES.ADMIN, ROLES.MANAGER, ROLES.STAFF]],
  '/purchases': [PurchasesList, [ROLES.ADMIN, ROLES.MANAGER, ROLES.STAFF]],
  '/transfers': [TransfersList, [ROLES.ADMIN, ROLES.MANAGER, ROLES.STAFF]],
  '/adjustments': [AdjustmentsList, [ROLES.ADMIN, ROLES.MANAGER, ROLES.STAFF, ROLES.AUDITOR]],
  '/categories': [CategoriesList, [ROLES.ADMIN]],
  '/suppliers': [SuppliersList, [ROLES.ADMIN, ROLES.MANAGER]],
  '/branches': [BranchesList, [ROLES.ADMIN]],
  '/low-stock': [LowStockList, [ROLES.ADMIN, ROLES.MANAGER]],
  '/reports': [ReportsView, [ROLES.ADMIN, ROLES.MANAGER, ROLES.AUDITOR]],
  '/audit-log': [AuditLogList, [ROLES.ADMIN, ROLES.MANAGER, ROLES.AUDITOR]],
  '/users': [UsersList, [ROLES.ADMIN]],
  '/settings': [SettingsView, [ROLES.ADMIN]],
}

export default function App() {
  return <Routes>
    <Route path="/" element={<LandingPage />} />
    <Route path="/login" element={<Login />} />
    <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
      {Object.entries(screens).map(([path, [Screen, roles]]) => <Route key={path} path={path}
        element={<ProtectedRoute roles={roles}><Screen /></ProtectedRoute>} />)}
    </Route>
    <Route path="*" element={<Navigate to="/dashboard" replace />} />
  </Routes>
}
