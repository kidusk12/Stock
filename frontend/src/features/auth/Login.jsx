import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from './AuthContext'
import { useTranslation } from 'react-i18next'
import { api } from '../../lib/api'
import { errorKey } from '../../lib/errorMessages'
import LanguageToggle from '../../components/LanguageToggle'
import { AlertCircle, ArrowRight, Boxes, Eye, EyeOff, Lock, User } from 'lucide-react'

const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true'

export default function Login() {
  const { login, user, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const { t } = useTranslation()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  if (authLoading) return <main role="status" className="min-h-screen grid place-items-center">{t('common.loading')}</main>
  if (user) return <Navigate to="/dashboard" replace />

  const sessionMessage = new URLSearchParams(location.search).get('session')

  const submitLogin = async (event, credentials = {}) => {
    event?.preventDefault()
    const submittedUsername = (credentials.username ?? username).trim()
    const submittedPassword = credentials.password ?? password

    if (!submittedUsername || !submittedPassword) {
      setErrorMsg(t('auth.errors.required'))
      return
    }

    setLoading(true)
    setErrorMsg('')
    try {
      const result = await api.post('/auth/login', {
        username: submittedUsername,
        password: submittedPassword,
      })
      login(result.user, result.token)
      navigate('/dashboard', { replace: true })
    } catch (error) {
      setErrorMsg(t(errorKey(error)))
    } finally {
      setLoading(false)
    }
  }

  const quickLogin = (role) => {
    const credentials = {
      admin: ['admin', 'Admin123!'],
      manager: ['manager', 'Manager123!'],
      staff: ['staff', 'Staff123!'],
      auditor: ['auditor', 'Auditor123!'],
    }[role]
    setUsername(credentials[0])
    setPassword(credentials[1])
    submitLogin(null, { username: credentials[0], password: credentials[1] })
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-slate-50">
      <div className="relative hidden lg:flex flex-col justify-between bg-deep p-12 text-white">
        <Link to="/" className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-blue-600 text-white shadow-lg"><Boxes className="h-6 w-6" aria-hidden="true" /></span>
          <span className="text-2xl font-bold tracking-tight">{t('app.name')}</span>
        </Link>
        <div className="max-w-md space-y-4">
          <div className="inline-block rounded-full bg-blue-500/20 px-3 py-1 text-xs font-semibold text-blue-300">{t('app.subtitle')}</div>
          <h2 className="text-4xl font-extrabold leading-tight text-white">{t('app.tagline')}</h2>
          <p className="text-slate-300 leading-relaxed text-sm">{t('auth.loginDescription')}</p>
        </div>
        <div className="text-xs text-slate-400">© 2026 {t('app.name')}. {t('landing.footerText')}</div>
      </div>

      <div className="flex flex-col justify-between p-6 sm:p-12">
        <div className="flex items-center justify-between">
          <Link to="/" className="flex lg:hidden items-center gap-2 font-bold text-slate-900">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-blue-600 text-white"><Boxes className="h-5 w-5" aria-hidden="true" /></span>
            <span className="text-lg font-bold">{t('app.name')}</span>
          </Link>
          <div className="ml-auto"><LanguageToggle /></div>
        </div>

        <div className="mx-auto w-full max-w-md my-auto py-8">
          <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-soft">
            <h1 className="text-2xl font-bold text-slate-900">{t('auth.welcome')}</h1>
            <p className="mt-1 text-sm text-slate-500">{t('auth.loginSubtitle')}</p>

            {sessionMessage && (
              <div role="status" className="mt-5 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
                <span>{t(sessionMessage === 'disabled' ? 'auth.sessionDisabled' : 'auth.sessionEnded')}</span>
              </div>
            )}

            {USE_MOCK && (
              <div className="mt-6 rounded-xl bg-slate-50 border border-slate-100 p-3.5">
                <p className="text-xs font-semibold text-slate-600 mb-2">{t('auth.testAsRole')}</p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {['admin', 'manager', 'staff', 'auditor'].map((role) => (
                    <button key={role} type="button" disabled={loading} onClick={() => quickLogin(role)} className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 font-semibold text-slate-700 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 transition disabled:opacity-50">
                      {t(`auth.${role}`)}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {errorMsg && (
              <div id="login-error" role="alert" aria-live="assertive" className="mt-4 flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm font-medium text-red-700 border border-red-200">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={submitLogin} className="mt-6 space-y-4" noValidate>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="username">{t('auth.username')}</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400"><User className="h-4 w-4" aria-hidden="true" /></span>
                  <input id="username" name="username" type="text" autoComplete="username" required aria-required="true" aria-invalid={Boolean(errorMsg)} aria-describedby={errorMsg ? 'login-error' : undefined} value={username} onChange={(event) => setUsername(event.target.value)} className="block w-full rounded-lg border border-slate-300 pl-10 pr-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="password">{t('auth.password')}</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400"><Lock className="h-4 w-4" aria-hidden="true" /></span>
                  <input id="password" name="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" required aria-required="true" aria-invalid={Boolean(errorMsg)} aria-describedby={errorMsg ? 'login-error' : undefined} value={password} onChange={(event) => setPassword(event.target.value)} className="block w-full rounded-lg border border-slate-300 pl-10 pr-12 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                  <button type="button" onClick={() => setShowPassword((visible) => !visible)} aria-label={t(showPassword ? 'auth.hidePassword' : 'auth.showPassword')} aria-pressed={showPassword} className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-500 hover:text-slate-800 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-600">
                    {showPassword ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
                  </button>
                </div>
              </div>

              <p className="text-xs leading-relaxed text-slate-500">{t('auth.forgotPassword')}</p>
              <button type="submit" disabled={loading} className="w-full flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 transition disabled:opacity-50">
                {loading ? t('common.loading') : t('auth.login')}<ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </form>
          </div>
        </div>

        <div className="text-center text-xs text-slate-400">{t('app.name')} · {t('app.subtitle')}</div>
      </div>
    </div>
  )
}
