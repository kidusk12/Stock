import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from './AuthContext'
import { useTranslation } from 'react-i18next'
import { api } from '../../lib/api'
import LanguageToggle from '../../components/LanguageToggle'
import { Boxes, Lock, User, AlertCircle, ArrowRight } from 'lucide-react'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const { t, i18n } = useTranslation()
  const isAm = i18n.language === 'am'

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const handleLogin = async (e, customUser, customPass) => {
    if (e) e.preventDefault()
    const userToSubmit = customUser || username
    const passToSubmit = customPass || password

    if (!userToSubmit || !passToSubmit) {
      setErrorMsg(isAm ? 'እባክዎ የተጠቃሚ ስም እና የይለፍ ቃል ያስገቡ' : 'Please enter username and password')
      return
    }

    setLoading(true)
    setErrorMsg('')

    try {
      const res = await api.post('/auth/login', {
        username: userToSubmit,
        password: passToSubmit,
      })

      login(res.user, res.token)
      navigate('/dashboard')
    } catch (err) {
      const code = err?.code || 'INVALID_CREDENTIALS'
      setErrorMsg(t(`errors.${code}`, 'Wrong username or password'))
    } finally {
      setLoading(false)
    }
  }

  const quickLoginAs = (userRole) => {
    let u = ''
    let p = 'Password123!'
    if (userRole === 'admin') { u = 'admin'; p = 'Admin123!'; }
    else if (userRole === 'manager') { u = 'manager'; p = 'Manager123!'; }
    else if (userRole === 'staff') { u = 'staff'; p = 'Staff123!'; }
    else if (userRole === 'auditor') { u = 'auditor'; p = 'Auditor123!'; }

    setUsername(u)
    setPassword(p)
    handleLogin(null, u, p)
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-slate-50">
      {/* Left Column (Branding banner) */}
      <div className="relative hidden lg:flex flex-col justify-between bg-deep p-12 text-white">
        <Link to="/" className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-blue-600 text-white shadow-lg">
            <Boxes className="h-6 w-6" />
          </span>
          <span className="text-2xl font-bold tracking-tight">{t('app.name')}</span>
        </Link>

        <div className="max-w-md space-y-4">
          <div className="inline-block rounded-full bg-blue-500/20 px-3 py-1 text-xs font-semibold text-blue-300">
            {t('app.subtitle')}
          </div>
          <h2 className="text-4xl font-extrabold leading-tight text-white">
            {t('app.tagline')}
          </h2>
          <p className="text-slate-300 leading-relaxed text-sm">
            {isAm
              ? 'በመላው ኢትዮጵያ ለሚገኙ ሱቆችዎ እና መጋዘኖችዎ የተዘጋጀ ዘመናዊ የክምችት፣ ሽያጭ እና ዝውውር መቆጣጠሪያ።'
              : 'Multi-branch stock, purchasing, sales, transfers, and immutable audit trail in one single place.'}
          </p>
        </div>

        <div className="text-xs text-slate-400">
          © 2026 {t('app.name')}. {t('landing.footerText')}
        </div>
      </div>

      {/* Right Column (Login form) */}
      <div className="flex flex-col justify-between p-6 sm:p-12">
        <div className="flex items-center justify-between">
          <Link to="/" className="flex lg:hidden items-center gap-2 font-bold text-slate-900">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-blue-600 text-white">
              <Boxes className="h-5 w-5" />
            </span>
            <span className="text-lg font-bold">{t('app.name')}</span>
          </Link>
          <div className="ml-auto">
            <LanguageToggle />
          </div>
        </div>

        <div className="mx-auto w-full max-w-md my-auto py-8">
          <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-soft">
            <h1 className="text-2xl font-bold text-slate-900">{t('auth.welcome')}</h1>
            <p className="mt-1 text-sm text-slate-500">{t('auth.loginSubtitle')}</p>

            {/* Mock Quick Role Switcher */}
            <div className="mt-6 rounded-xl bg-slate-50 border border-slate-100 p-3.5">
              <p className="text-xs font-semibold text-slate-600 mb-2">
                {t('auth.testAsRole')}
              </p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => quickLoginAs('admin')}
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 font-semibold text-slate-700 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 transition"
                >
                  👑 {t('auth.admin')}
                </button>
                <button
                  type="button"
                  onClick={() => quickLoginAs('manager')}
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 font-semibold text-slate-700 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 transition"
                >
                  🏢 {t('auth.manager')}
                </button>
                <button
                  type="button"
                  onClick={() => quickLoginAs('staff')}
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 font-semibold text-slate-700 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 transition"
                >
                  👤 {t('auth.staff')}
                </button>
                <button
                  type="button"
                  onClick={() => quickLoginAs('auditor')}
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 font-semibold text-slate-700 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 transition"
                >
                  🔍 {t('auth.auditor')}
                </button>
              </div>
            </div>

            {errorMsg && (
              <div className="mt-4 flex items-center gap-2 rounded-lg bg-red-50 p-3 text-xs font-medium text-red-700 border border-red-200">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleLogin} className="mt-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="username">
                  {t('auth.username')}
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <User className="h-4 w-4" />
                  </div>
                  <input
                    id="username"
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="e.g. admin or staff"
                    className="block w-full rounded-lg border border-slate-300 pl-10 pr-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="password">
                  {t('auth.password')}
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Lock className="h-4 w-4" />
                  </div>
                  <input
                    id="password"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="block w-full rounded-lg border border-slate-300 pl-10 pr-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 transition disabled:opacity-50"
              >
                {loading ? t('common.loading') : t('auth.login')}
                <ArrowRight className="h-4 w-4" />
              </button>
            </form>
          </div>
        </div>

        <div className="text-center text-xs text-slate-400">
          Berhan Stock · Multi-Branch Management
        </div>
      </div>
    </div>
  )
}