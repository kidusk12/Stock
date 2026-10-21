import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { KeyRound } from 'lucide-react'
import { useAuth } from '../auth/AuthContext'
import { api } from '../../lib/api'
import { errorKey } from '../../lib/errorMessages'

export default function ProfileView() {
  const { user } = useAuth()
  const { t } = useTranslation()
  const roleKey = user?.role === 'BRANCH_MANAGER' ? 'manager' : String(user?.role || '').toLowerCase()
  const [passwordData, setPasswordData] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })
  const [status, setStatus] = useState({ success: '', error: '' })
  const [saving, setSaving] = useState(false)

  const changePassword = async (event) => {
    event.preventDefault()
    setStatus({ success: '', error: '' })

    if (!passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword) {
      setStatus({ success: '', error: t('auth.errors.required') })
      return
    }
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setStatus({ success: '', error: t('auth.errors.passwordMismatch') })
      return
    }
    if (passwordData.newPassword.length < 8) {
      setStatus({ success: '', error: t('auth.errors.passwordTooShort') })
      return
    }

    setSaving(true)
    try {
      await api.post('/auth/change-password', {
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword,
      })
      setStatus({ success: t('auth.passwordChanged'), error: '' })
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' })
    } catch (error) {
      setStatus({ success: '', error: t(errorKey(error)) })
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="mx-auto max-w-3xl space-y-6 pb-12">
      <header>
        <h1 className="text-2xl font-extrabold text-[#15343f]">{t('profile.title')}</h1>
        <p className="mt-1 text-sm text-[#728994]">{t('profile.description')}</p>
      </header>

      <section className="rounded-2xl border border-[#cfdde3] bg-white p-6 shadow-clean">
        <h2 className="mb-4 text-sm font-bold text-[#15343f]">{t('profile.accountDetails')}</h2>
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div><dt className="text-xs text-[#728994]">{t('auth.username')}</dt><dd className="mt-1 font-semibold text-[#15343f]">{user?.username || '—'}</dd></div>
          <div><dt className="text-xs text-[#728994]">{t('profile.fullName')}</dt><dd className="mt-1 font-semibold text-[#15343f]">{user?.fullName || '—'}</dd></div>
          <div><dt className="text-xs text-[#728994]">{t('profile.role')}</dt><dd className="mt-1 font-semibold text-[#15343f]">{t(`auth.roles.${roleKey}`, { defaultValue: user?.role || '—' })}</dd></div>
          <div><dt className="text-xs text-[#728994]">{t('profile.branch')}</dt><dd className="mt-1 font-semibold text-[#15343f]">{user?.branchName || t('profile.allBranches')}</dd></div>
        </dl>
      </section>

      <form onSubmit={changePassword} noValidate className="space-y-4 rounded-2xl border border-[#cfdde3] bg-white p-6 shadow-clean">
        <h2 className="flex items-center gap-2 text-sm font-bold text-[#15343f]">
          <KeyRound className="h-4 w-4" aria-hidden="true" />{t('auth.changePassword')}
        </h2>
        {status.error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{status.error}</div>}
        {status.success && <div role="status" className="rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-800">{status.success}</div>}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <label className="text-xs font-semibold text-[#15343f]">{t('auth.currentPassword')}
            <input required type="password" autoComplete="current-password" value={passwordData.currentPassword} onChange={(event) => setPasswordData({ ...passwordData, currentPassword: event.target.value })} className="mt-1 w-full rounded-xl border border-[#cadbe2] bg-[#f8fbfa] px-3 py-2 text-sm" />
          </label>
          <label className="text-xs font-semibold text-[#15343f]">{t('auth.newPassword')}
            <input required type="password" autoComplete="new-password" value={passwordData.newPassword} onChange={(event) => setPasswordData({ ...passwordData, newPassword: event.target.value })} className="mt-1 w-full rounded-xl border border-[#cadbe2] bg-[#f8fbfa] px-3 py-2 text-sm" />
          </label>
          <label className="text-xs font-semibold text-[#15343f]">{t('auth.confirmNewPassword')}
            <input required type="password" autoComplete="new-password" value={passwordData.confirmPassword} onChange={(event) => setPasswordData({ ...passwordData, confirmPassword: event.target.value })} className="mt-1 w-full rounded-xl border border-[#cadbe2] bg-[#f8fbfa] px-3 py-2 text-sm" />
          </label>
        </div>
        <button type="submit" disabled={saving} className="rounded-xl bg-[#173d4a] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#12303a] disabled:opacity-50">
          {saving ? t('common.loading') : t('auth.updatePassword')}
        </button>
      </form>
    </main>
  )
}
