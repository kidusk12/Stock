import { Navigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../features/auth/AuthContext'
import Forbidden from './Forbidden'

export default function ProtectedRoute({ children, roles }) {
  const { user, loading } = useAuth()
  const { t } = useTranslation()
  if (loading) return <main role="status" className="min-h-screen grid place-items-center">{t('common.loading')}</main>
  if (!user) return <Navigate to="/login" replace />
  if (roles && !roles.includes(user.role)) return <Forbidden />
  return children
}
