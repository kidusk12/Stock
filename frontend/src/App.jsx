import { Routes, Route, Navigate } from 'react-router-dom'
import ProtectedRoute from './components/ProtectedRoute'
import AppLayout from './components/layout/AppLayout'
import LandingPage from './features/landing/LandingPage'
import Login from './features/auth/Login'
import Dashboard from './features/dashboard/Dashboard'
import ProductsList from './features/products/ProductsList'
import SalesPos from './features/sales/SalesPos'
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
import ProfileView from './features/profile/ProfileView'
import { ROLES } from './config/menu'

export default function App() {
  const { ADMIN, MANAGER, STAFF, AUDITOR } = ROLES

  return (
    <Routes>
      {/* Public Landing Page */}
      <Route path="/" element={<LandingPage />} />

      {/* Login Screen */}
      <Route path="/login" element={<Login />} />

      {/* Authenticated Application */}
      <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute roles={[ADMIN, MANAGER, STAFF, AUDITOR]}>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/products"
          element={
            <ProtectedRoute roles={[ADMIN, MANAGER, STAFF, AUDITOR]}>
              <ProductsList />
            </ProtectedRoute>
          }
        />
        <Route
          path="/sales"
          element={
            <ProtectedRoute roles={[ADMIN, MANAGER, STAFF]}>
              <SalesPos />
            </ProtectedRoute>
          }
        />
        <Route
          path="/returns"
          element={
            <ProtectedRoute roles={[ADMIN, MANAGER, STAFF]}>
              <ReturnsList />
            </ProtectedRoute>
          }
        />
        <Route
          path="/purchases"
          element={
            <ProtectedRoute roles={[ADMIN, MANAGER, STAFF]}>
              <PurchasesList />
            </ProtectedRoute>
          }
        />
        <Route
          path="/transfers"
          element={
            <ProtectedRoute roles={[ADMIN, MANAGER, STAFF]}>
              <TransfersList />
            </ProtectedRoute>
          }
        />
        <Route
          path="/adjustments"
          element={
            <ProtectedRoute roles={[ADMIN, MANAGER, STAFF, AUDITOR]}>
              <AdjustmentsList />
            </ProtectedRoute>
          }
        />
        <Route
          path="/categories"
          element={
            <ProtectedRoute roles={[ADMIN]}>
              <CategoriesList />
            </ProtectedRoute>
          }
        />
        <Route
          path="/suppliers"
          element={
            <ProtectedRoute roles={[ADMIN, MANAGER]}>
              <SuppliersList />
            </ProtectedRoute>
          }
        />
        <Route
          path="/branches"
          element={
            <ProtectedRoute roles={[ADMIN]}>
              <BranchesList />
            </ProtectedRoute>
          }
        />
        <Route
          path="/low-stock"
          element={
            <ProtectedRoute roles={[ADMIN, MANAGER]}>
              <LowStockList />
            </ProtectedRoute>
          }
        />
        <Route
          path="/reports"
          element={
            <ProtectedRoute roles={[ADMIN, MANAGER, AUDITOR]}>
              <ReportsView />
            </ProtectedRoute>
          }
        />
        <Route
          path="/audit-log"
          element={
            <ProtectedRoute roles={[ADMIN, MANAGER, AUDITOR]}>
              <AuditLogList />
            </ProtectedRoute>
          }
        />
        <Route
          path="/users"
          element={
            <ProtectedRoute roles={[ADMIN]}>
              <UsersList />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedRoute roles={[ADMIN]}>
              <SettingsView />
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile"
          element={
            <ProtectedRoute roles={[ADMIN, MANAGER, STAFF, AUDITOR]}>
              <ProfileView />
            </ProtectedRoute>
          }
        />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}