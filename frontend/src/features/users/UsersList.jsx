import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Building2, KeyRound, Plus, Search, Shield, UserCog, X } from 'lucide-react'
import { useAuth } from '../auth/AuthContext'
import { api } from '../../lib/api'

const LIMIT = 20
const INITIAL_FORM = { username: '', fullName: '', password: '', role: 'STAFF', branchId: '' }
const ASSIGNABLE_ROLES = ['BRANCH_MANAGER', 'STAFF', 'AUDITOR']

export default function UsersList() {
  const { user: currentUser, updateProfile } = useAuth()
  const { t } = useTranslation()
  const [users, setUsers] = useState([])
  const [branches, setBranches] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [branchFilter, setBranchFilter] = useState('')
  const [includeInactive, setIncludeInactive] = useState(false)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [pageCount, setPageCount] = useState(1)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [formData, setFormData] = useState(INITIAL_FORM)
  const [resetTarget, setResetTarget] = useState(null)
  const [newPassword, setNewPassword] = useState('')
  const [modalError, setModalError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const isEditingAdmin = editing?.role === 'ADMIN'

  const loadUsers = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const result = await api.get('/users', {
        q: query.trim() || undefined,
        role: roleFilter || undefined,
        branchId: branchFilter || undefined,
        includeInactive: includeInactive || undefined,
        page,
        limit: LIMIT,
      })
      setUsers(result.data || [])
      setTotal(result.total ?? result.data?.length ?? 0)
      setPageCount(Math.max(1, Math.ceil((result.total ?? 0) / (result.limit || LIMIT))))
    } catch (err) {
      setError(t(`errors.${err.code}`, { defaultValue: t('users.loadError') }))
    } finally {
      setLoading(false)
    }
  }, [branchFilter, includeInactive, page, query, roleFilter, t])

  useEffect(() => {
    api.get('/branches').then((result) => setBranches(result.data || [])).catch(() => {})
  }, [])
  useEffect(() => { void loadUsers() }, [loadUsers])

  const openCreate = () => {
    setEditing(null)
    setFormData(INITIAL_FORM)
    setModalError('')
    setShowModal(true)
  }

  const openEdit = (account) => {
    setEditing(account)
    setFormData({
      username: account.username || '',
      fullName: account.fullName || '',
      password: '',
      role: account.role || 'STAFF',
      branchId: account.branchId == null ? '' : String(account.branchId),
    })
    setModalError('')
    setShowModal(true)
  }

  const handleSave = async (event) => {
    event.preventDefault()
    setModalError('')
    const hasBranch = ['BRANCH_MANAGER', 'STAFF'].includes(formData.role)
    if (hasBranch && !formData.branchId) {
      setModalError(t('users.branchRequired'))
      return
    }
    if (!editing && formData.password.length < 8) {
      setModalError(t('users.passwordMinimum'))
      return
    }

    setSubmitting(true)
    const payload = {
      fullName: formData.fullName.trim(),
      role: formData.role,
      branchId: hasBranch ? Number(formData.branchId) : null,
    }
    try {
      if (editing) {
        await api.patch(`/users/${editing.id}`, payload)
        if (editing.id === currentUser?.id) updateProfile({ fullName: payload.fullName })
      }
      else await api.post('/users', { ...payload, username: formData.username.trim(), password: formData.password })
      setShowModal(false)
      await loadUsers()
    } catch (err) {
      setModalError(t(`errors.${err.code}`, { defaultValue: t('users.saveError') }))
    } finally {
      setSubmitting(false)
    }
  }

  const toggleActive = async (account) => {
    setError('')
    try {
      await api.patch(`/users/${account.id}`, { isActive: !account.isActive })
      await loadUsers()
    } catch (err) {
      setError(t(`errors.${err.code}`, { defaultValue: t('users.statusError') }))
    }
  }

  const handleResetPassword = async (event) => {
    event.preventDefault()
    setModalError('')
    if (newPassword.length < 8) {
      setModalError(t('users.passwordMinimum'))
      return
    }
    setSubmitting(true)
    try {
      await api.post(`/users/${resetTarget.id}/reset-password`, { newPassword })
      setResetTarget(null)
      setNewPassword('')
    } catch (err) {
      setModalError(t(`errors.${err.code}`, { defaultValue: t('users.resetError') }))
    } finally {
      setSubmitting(false)
    }
  }

  const roleLabel = (role) => t(`users.roles.${role}`, { defaultValue: role })

  return (
    <div className="space-y-6">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight text-slate-900"><UserCog className="h-6 w-6 text-teal-700" aria-hidden="true" />{t('users.title')}</h1>
        <p className="mt-1 text-sm text-slate-500">{t('users.description')}</p>
        </div>
        {currentUser?.role === 'ADMIN' && <button type="button" onClick={openCreate} className="inline-flex items-center gap-2 self-start rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-teal-800"><Plus className="h-4 w-4" aria-hidden="true" />{t('users.addUser')}</button>}
      </header>

      <section className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 lg:flex-row lg:items-center">
        <label className="relative min-w-0 flex-1"><span className="sr-only">{t('users.search')}</span><Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" aria-hidden="true" /><input type="search" value={query} onChange={(event) => { setQuery(event.target.value); setPage(1) }} placeholder={t('users.search')} className="w-full rounded-xl border border-slate-300 py-2 pl-9 pr-3 text-sm focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-100" /></label>
        <label><span className="sr-only">{t('users.role')}</span><select value={roleFilter} onChange={(event) => { setRoleFilter(event.target.value); setPage(1) }} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm sm:w-48"><option value="">{t('users.allRoles')}</option>{['ADMIN', ...ASSIGNABLE_ROLES].map((role) => <option key={role} value={role}>{roleLabel(role)}</option>)}</select></label>
        <label><span className="sr-only">{t('users.branch')}</span><select value={branchFilter} onChange={(event) => { setBranchFilter(event.target.value); setPage(1) }} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm sm:w-52"><option value="">{t('users.allBranches')}</option>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></label>
        <label className="flex shrink-0 items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={includeInactive} onChange={(event) => { setIncludeInactive(event.target.checked); setPage(1) }} className="rounded border-slate-300 text-teal-700 focus:ring-teal-600" />{t('users.showInactive')}</label>
      </section>

      {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}<button type="button" onClick={() => void loadUsers()} className="ml-2 font-bold underline">{t('common.retry')}</button></div>}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-soft">
        <div className="overflow-x-auto"><table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase tracking-wide text-slate-600"><tr><th className="px-4 py-3">{t('users.fullName')}</th><th className="px-4 py-3">{t('auth.username')}</th><th className="px-4 py-3">{t('users.role')}</th><th className="px-4 py-3">{t('users.branch')}</th><th className="px-4 py-3 text-center">{t('users.status')}</th><th className="px-4 py-3 text-right">{t('common.actions')}</th></tr></thead>
          <tbody className="divide-y divide-slate-100 text-slate-700">{loading ? <tr><td colSpan="6" className="py-12 text-center text-slate-500" role="status">{t('common.loading')}</td></tr> : users.length === 0 ? <tr><td colSpan="6" className="py-12 text-center text-slate-500">{t('users.empty')}</td></tr> : users.map((account) => <tr key={account.id} className={`hover:bg-slate-50/70 ${account.isActive ? '' : 'bg-amber-50/40'}`}>
            <td className="px-4 py-3 font-semibold text-slate-900">{account.fullName}</td><td className="px-4 py-3 font-mono text-xs">{account.username}</td><td className="px-4 py-3"><span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold"><Shield className="h-3 w-3" aria-hidden="true" />{roleLabel(account.role)}</span></td><td className="px-4 py-3"><span className="inline-flex items-center gap-1.5">{account.branchId != null && <Building2 className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />}{account.branchName || t('users.allBranches')}</span></td><td className="px-4 py-3 text-center"><span className={`rounded-full border px-2.5 py-1 text-xs font-bold ${account.isActive ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>{account.isActive ? t('users.active') : t('users.inactive')}</span></td>
            <td className="px-4 py-3"><div className="flex justify-end gap-3 whitespace-nowrap"><button type="button" onClick={() => openEdit(account)} className="font-semibold text-teal-800 hover:underline">{t('common.edit')}</button>{account.role !== 'ADMIN' && <><button type="button" onClick={() => { setResetTarget(account); setNewPassword(''); setModalError('') }} className="inline-flex items-center gap-1 font-semibold text-slate-700 hover:underline"><KeyRound className="h-3.5 w-3.5" aria-hidden="true" />{t('users.resetPassword')}</button><button type="button" disabled={account.id === currentUser?.id && account.isActive} onClick={() => void toggleActive(account)} className="font-semibold text-slate-600 hover:underline disabled:cursor-not-allowed disabled:opacity-40" title={account.id === currentUser?.id ? t('users.selfDeactivateBlocked') : undefined}>{account.isActive ? t('users.deactivate') : t('users.activate')}</button></>}</div></td>
          </tr>)}</tbody>
        </table></div>
      </div>
      {!loading && pageCount > 1 && <div className="flex items-center justify-between text-sm text-slate-600"><span>{t('users.pageSummary', { page, pageCount, total })}</span><div className="flex gap-2"><button type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)} className="rounded-lg border border-slate-300 px-3 py-1.5 font-semibold disabled:opacity-40">{t('common.previous')}</button><button type="button" disabled={page >= pageCount} onClick={() => setPage((value) => value + 1)} className="rounded-lg border border-slate-300 px-3 py-1.5 font-semibold disabled:opacity-40">{t('common.next')}</button></div></div>}

      {showModal && <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget && !submitting) setShowModal(false) }}><section role="dialog" aria-modal="true" aria-labelledby="user-dialog-title" className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
        <div className="flex items-center justify-between"><div><h2 id="user-dialog-title" className="text-lg font-extrabold text-slate-900">{editing ? t('users.editUser') : t('users.addUser')}</h2><p className="mt-1 text-sm text-slate-500">{editing ? t('users.editDescription') : t('users.createDescription')}</p></div><button type="button" onClick={() => setShowModal(false)} aria-label={t('common.close')} className="rounded-lg p-1 text-slate-500 hover:bg-slate-100"><X className="h-5 w-5" aria-hidden="true" /></button></div>
        <form onSubmit={handleSave} className="mt-5 space-y-4">
          <label className="block text-sm font-semibold text-slate-700">{t('users.fullName')}<input autoFocus required maxLength={100} value={formData.fullName} onChange={(event) => setFormData((previous) => ({ ...previous, fullName: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-100" /></label>
          {!editing && <><label className="block text-sm font-semibold text-slate-700">{t('auth.username')}<input required minLength={3} maxLength={50} autoComplete="off" value={formData.username} onChange={(event) => setFormData((previous) => ({ ...previous, username: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-100" /></label><label className="block text-sm font-semibold text-slate-700">{t('users.temporaryPassword')}<input type="password" required minLength={8} autoComplete="new-password" value={formData.password} onChange={(event) => setFormData((previous) => ({ ...previous, password: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-100" /></label></>}
          <label className="block text-sm font-semibold text-slate-700">{t('users.role')}{isEditingAdmin ? <input disabled value={roleLabel('ADMIN')} className="mt-1 w-full rounded-lg border border-slate-300 bg-slate-100 px-3 py-2 text-slate-600" /> : <select value={formData.role} onChange={(event) => setFormData((previous) => ({ ...previous, role: event.target.value, branchId: previous.branchId }))} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2">{ASSIGNABLE_ROLES.map((role) => <option key={role} value={role}>{roleLabel(role)}</option>)}</select>}</label>
          <label className="block text-sm font-semibold text-slate-700">{t('users.branch')}{['BRANCH_MANAGER', 'STAFF'].includes(formData.role) && <span aria-hidden="true"> *</span>}<select required={['BRANCH_MANAGER', 'STAFF'].includes(formData.role)} disabled={!['BRANCH_MANAGER', 'STAFF'].includes(formData.role)} value={formData.branchId} onChange={(event) => setFormData((previous) => ({ ...previous, branchId: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 disabled:bg-slate-100 disabled:text-slate-500"><option value="">{t('users.noBranch')}</option>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></label>
          {modalError && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{modalError}</div>}
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4"><button type="button" disabled={submitting} onClick={() => setShowModal(false)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold">{t('common.cancel')}</button><button type="submit" disabled={submitting} className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-bold text-white hover:bg-teal-800 disabled:opacity-50">{submitting ? t('common.loading') : t('common.save')}</button></div>
        </form>
      </section></div>}

      {resetTarget && <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget && !submitting) setResetTarget(null) }}><section role="dialog" aria-modal="true" aria-labelledby="reset-password-title" className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-3"><div><h2 id="reset-password-title" className="text-lg font-extrabold text-slate-900">{t('users.resetPassword')}</h2><p className="mt-1 text-sm text-slate-600">{resetTarget.fullName} · {resetTarget.username}</p></div><button type="button" onClick={() => setResetTarget(null)} aria-label={t('common.close')} className="rounded-lg p-1 text-slate-500 hover:bg-slate-100"><X className="h-5 w-5" aria-hidden="true" /></button></div>
        <form onSubmit={handleResetPassword} className="mt-5 space-y-4"><label className="block text-sm font-semibold text-slate-700">{t('users.newPassword')}<input type="password" required minLength={8} autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" /></label>{modalError && <div role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{modalError}</div>}<div className="flex justify-end gap-2 border-t border-slate-100 pt-4"><button type="button" disabled={submitting} onClick={() => setResetTarget(null)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold">{t('common.cancel')}</button><button type="submit" disabled={submitting} className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{submitting ? t('common.loading') : t('users.resetPassword')}</button></div></form>
      </section></div>}
    </div>
  )
}
