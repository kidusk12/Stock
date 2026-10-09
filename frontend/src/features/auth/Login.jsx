import { useNavigate } from 'react-router-dom'
import { useAuth } from './AuthContext'
import { ROLES } from '../../config/menu'
import { useTranslation } from 'react-i18next'
import LanguageToggle from '../../components/LanguageToggle'

// DEV ONLY: removed when the real login is connected.
const TEST_USERS = [
  { name: 'Abebe', role: ROLES.ADMIN, branchId: null },
  { name: 'Marta', role: ROLES.MANAGER, branchId: 1 },
  { name: 'Dawit', role: ROLES.STAFF, branchId: 1 },
  { name: 'Yonas', role: ROLES.AUDITOR, branchId: null },
]

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const signIn = (user) => {
    login(user)
    navigate('/dashboard')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="absolute top-4 right-4"><LanguageToggle /></div>
      <div className="bg-white p-8 rounded-lg shadow w-96">
        <h1 className="text-xl font-bold mb-4">{t('app.name')}</h1>
        <p className="text-xs text-gray-400 mb-3">DEV: pick a role</p>
        <div className="flex flex-col gap-2">
          {TEST_USERS.map((u) => (
            <button
              key={u.role}
              onClick={() => signIn(u)}
              className="border rounded px-4 py-2 text-left hover:bg-gray-100"
            >
              {u.fullName} ({u.role})
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}