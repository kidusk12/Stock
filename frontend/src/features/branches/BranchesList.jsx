import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../auth/AuthContext'
import { api } from '../../lib/api'
import { Building2, MapPin, Phone, Plus, Save, X } from 'lucide-react'

const EMPTY_FORM = { name: '', code: '', address: '', phone: '' }

export default function BranchesList() {
  const { user } = useAuth()
  const { t } = useTranslation()
  const isAdmin = user?.role === 'ADMIN'
  const [branches, setBranches] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [includeInactive, setIncludeInactive] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [editingBranch, setEditingBranch] = useState(null)
  const [formData, setFormData] = useState(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)

  const loadBranches = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const result = await api.get('/branches', { includeInactive: includeInactive || undefined, limit: 100 })
      setBranches(result.data || [])
    } catch (err) {
      setError(t(`errors.${err.code}`, { defaultValue: t('branches.loadError') }))
    } finally {
      setLoading(false)
    }
  }, [includeInactive, t])

  useEffect(() => { loadBranches() }, [loadBranches])

  const openCreate = () => {
    setEditingBranch(null)
    setFormData(EMPTY_FORM)
    setError('')
    setShowModal(true)
  }

  const openEdit = (branch) => {
    setEditingBranch(branch)
    setFormData({ name: branch.name || '', code: branch.code || '', address: branch.address || '', phone: branch.phone || '' })
    setError('')
    setShowModal(true)
  }

  const handleSave = async (event) => {
    event.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      const payload = {
        name: formData.name.trim(),
        code: formData.code.trim().toUpperCase(),
        address: formData.address.trim(),
        phone: formData.phone.trim(),
      }
      if (editingBranch) await api.patch(`/branches/${editingBranch.id}`, payload)
      else await api.post('/branches', payload)
      setShowModal(false)
      setFormData(EMPTY_FORM)
      await loadBranches()
    } catch (err) {
      setError(t(`errors.${err.code}`, { defaultValue: t('branches.saveError') }))
    } finally {
      setSubmitting(false)
    }
  }

  const toggleActive = async (branch) => {
    setError('')
    try {
      await api.patch(`/branches/${branch.id}`, { isActive: !branch.isActive })
      await loadBranches()
    } catch (err) {
      setError(t(`errors.${err.code}`, { defaultValue: t('branches.statusError') }))
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">{t('nav.branches')}</h1>
          <p className="mt-1 text-sm text-slate-500">{t('branches.description')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {isAdmin && (
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input type="checkbox" checked={includeInactive} onChange={(e) => setIncludeInactive(e.target.checked)} className="rounded border-slate-300 text-teal-700 focus:ring-teal-600" />
              {t('branches.showInactive')}
            </label>
          )}
          {isAdmin && (
            <button type="button" onClick={openCreate} className="inline-flex items-center gap-2 rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-teal-800">
              <Plus className="h-4 w-4" aria-hidden="true" />{t('branches.add')}
            </button>
          )}
        </div>
      </div>

      {error && !showModal && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800" role="alert">{error}</div>}

      {loading ? (
        <p className="py-12 text-center text-sm text-slate-500" role="status">{t('common.loading')}</p>
      ) : branches.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">{t('branches.empty')}</div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {branches.map((branch) => (
            <article key={branch.id} className={`flex flex-col justify-between rounded-2xl border bg-white p-5 shadow-soft ${branch.isActive ? 'border-slate-200' : 'border-amber-200 opacity-80'}`}>
              <div>
                <div className="flex items-start justify-between gap-3">
                  <h2 className="flex items-center gap-2 text-sm font-extrabold text-slate-900"><Building2 className="h-4 w-4 text-teal-700" aria-hidden="true" />{branch.name}</h2>
                  {branch.code && <span className="rounded-md border border-teal-200 bg-teal-50 px-2 py-0.5 font-mono text-[11px] font-bold text-teal-800">{branch.code}</span>}
                </div>
                <div className="mt-4 space-y-2 text-sm text-slate-600">
                  {branch.address && <div className="flex items-start gap-2"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" /><span>{branch.address}</span></div>}
                  {branch.phone && <div className="flex items-center gap-2"><Phone className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" /><span>{branch.phone}</span></div>}
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs">
                <span className={`font-bold ${branch.isActive ? 'text-emerald-700' : 'text-amber-700'}`}>{branch.isActive ? t('branches.active') : t('branches.inactive')}</span>
                {isAdmin && <div className="flex gap-3">
                  <button type="button" onClick={() => openEdit(branch)} className="font-semibold text-teal-800 underline-offset-2 hover:underline">{t('common.edit')}</button>
                  <button type="button" onClick={() => toggleActive(branch)} className="font-semibold text-slate-600 underline-offset-2 hover:underline">
                    {branch.isActive ? t('branches.deactivate') : t('branches.activate')}
                  </button>
                </div>}
              </div>
            </article>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) setShowModal(false) }}>
          <section role="dialog" aria-modal="true" aria-labelledby="branch-dialog-title" className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <h2 id="branch-dialog-title" className="text-base font-extrabold text-slate-900">{editingBranch ? t('branches.editTitle') : t('branches.addTitle')}</h2>
              <button type="button" onClick={() => setShowModal(false)} aria-label={t('common.cancel')} className="rounded-lg p-1 text-slate-500 hover:bg-slate-100"><X className="h-5 w-5" /></button>
            </div>
            <form onSubmit={handleSave} className="mt-5 space-y-4">
              {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">{error}</div>}
              <div>
                <label htmlFor="branch-name" className="mb-1 block text-sm font-bold text-slate-700">{t('branches.name')} *</label>
                <input id="branch-name" name="name" type="text" required maxLength={150} autoFocus value={formData.name}
                  onChange={(e) => setFormData((s) => ({ ...s, name: e.target.value }))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-100" />
              </div>
              <div>
                <label htmlFor="branch-code" className="mb-1 block text-sm font-bold text-slate-700">{t('branches.code')}</label>
                <input id="branch-code" name="code" type="text" maxLength={30} autoCapitalize="characters" value={formData.code}
                  onChange={(e) => setFormData((s) => ({ ...s, code: e.target.value.toUpperCase() }))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-100" />
              </div>
              <div>
                <label htmlFor="branch-address" className="mb-1 block text-sm font-bold text-slate-700">{t('branches.address')}</label>
                <input id="branch-address" name="address" type="text" autoComplete="street-address" value={formData.address}
                  onChange={(e) => setFormData((s) => ({ ...s, address: e.target.value }))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-100" />
              </div>
              <div>
                <label htmlFor="branch-phone" className="mb-1 block text-sm font-bold text-slate-700">{t('branches.phone')}</label>
                <input id="branch-phone" name="phone" type="tel" autoComplete="tel" value={formData.phone}
                  onChange={(e) => setFormData((s) => ({ ...s, phone: e.target.value }))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-100" />
              </div>
              <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
                <button type="button" onClick={() => setShowModal(false)} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50">{t('common.cancel')}</button>
                <button type="submit" disabled={submitting} className="inline-flex items-center gap-2 rounded-xl bg-teal-700 px-5 py-2 text-sm font-bold text-white hover:bg-teal-800 disabled:opacity-50">
                  <Save className="h-4 w-4" aria-hidden="true" />{submitting ? t('common.loading') : t('common.save')}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  )
}
