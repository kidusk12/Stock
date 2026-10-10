import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from './AuthContext'
import { api } from '../../lib/api'
import { errorKey } from '../../lib/errorMessages'
import LanguageToggle from '../../components/LanguageToggle'

export default function Login() {
  const { t } = useTranslation()
  const { user, login } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null) // a translation key
  const [submitting, setSubmitting] = useState(false)

  // Already logged in: go straight to the app
  if (user) return <Navigate to="/dashboard" replace />

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    if (!username.trim() || !password) {
      setError('auth.required')
      return
    }
    setSubmitting(true)
    try {
      const result = await api.post('/auth/login', { username: username.trim(), password })
      login(result) // user becomes set, and the redirect above takes over
    } catch (err) {
      setError(errorKey(err)) // e.g. INVALID_CREDENTIALS, ACCOUNT_DISABLED, NETWORK_ERROR
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="absolute top-4 right-4">
        <LanguageToggle />
      </div>
      <form onSubmit={handleSubmit} className="bg-white p-8 rounded-lg shadow w-96 flex flex-col gap-4">
        <h1 className="text-xl font-bold text-brand">{t('app.name')}</h1>

        <label className="flex flex-col gap-1 text-sm">
          {t('auth.username')}
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            autoFocus
            className="border rounded px-3 py-2"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          {t('auth.password')}
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            className="border rounded px-3 py-2"
          />
        </label>

        {error && (
          <p role="alert" className="text-sm text-red-600">
            {t(error)}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="bg-brand text-white rounded px-4 py-2 hover:bg-brand-dark disabled:opacity-60"
        >
          {submitting ? t('auth.signingIn') : t('auth.login')}
        </button>

        {import.meta.env.VITE_USE_MOCK === 'true' && <p className="text-xs text-gray-400">{t('auth.devHint')}</p>}
      </form>
    </div>
  )
}