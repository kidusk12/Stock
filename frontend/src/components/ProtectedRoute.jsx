import { Navigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../features/auth/AuthContext'

export default function ProtectedRoute({ children, roles }) {
  const { t } = useTranslation()
  const { user, checking } = useAuth()

  if (checking) return <div className="p-6 text-gray-500">{t('common.loading')}</div>
  if (!user) return <Navigate to="/login" replace />
  if (roles && !roles.includes(user.role)) return <Navigate to="/dashboard" replace />
  return children
}