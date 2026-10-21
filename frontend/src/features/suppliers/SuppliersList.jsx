import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../auth/AuthContext'
import { api } from '../../lib/api'
import { MapPin, Phone, Plus, Save, Search, Users, X } from 'lucide-react'

const EMPTY_FORM = { name: '', contactName: '', phone: '', tin: '', address: '' }

export default function SuppliersList() {
  const { user } = useAuth()
  const { t } = useTranslation()
  const canManage = ['ADMIN', 'BRANCH_MANAGER'].includes(user?.role)
  const [suppliers, setSuppliers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [includeInactive, setIncludeInactive] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [editingSupplier, setEditingSupplier] = useState(null)
  const [formData, setFormData] = useState(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)

  const loadSuppliers = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const result = await api.get('/suppliers', { q: query.trim() || undefined, includeInactive: includeInactive || undefined, limit: 100 })
      setSuppliers(result.data || [])
    } catch (err) {
      setError(t(`errors.${err.code}`, { defaultValue: t('suppliers.loadError') }))
    } finally {
      setLoading(false)
    }
  }, [includeInactive, query, t])

  useEffect(() => {
    // This effect starts an asynchronous API load; the resulting state updates happen after the request resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadSuppliers()
  }, [loadSuppliers])

  const openCreate = () => {
    setEditingSupplier(null)
    setFormData(EMPTY_FORM)
    setError('')
    setShowModal(true)
  }

  const openEdit = (supplier) => {
    setEditingSupplier(supplier)
    setFormData({
      name: supplier.name || '',
      contactName: supplier.contactName || supplier.contact || '',
      phone: supplier.phone || '',
      tin: supplier.tin || '',
      address: supplier.address || '',
    })
    setError('')
    setShowModal(true)
  }

  const handleSave = async (event) => {
    event.preventDefault()
    setSubmitting(true)
    setError('')
    const payload = Object.fromEntries(Object.entries(formData).map(([key, value]) => [key, value.trim()]))
    try {
      if (editingSupplier) await api.patch(`/suppliers/${editingSupplier.id}`, payload)
      else await api.post('/suppliers', payload)
      setShowModal(false)
      await loadSuppliers()
    } catch (err) {
      setError(t(`errors.${err.code}`, { defaultValue: t('suppliers.saveError') }))
    } finally {
      setSubmitting(false)
    }
  }

  const toggleActive = async (supplier) => {
    setError('')
    try {
      await api.patch(`/suppliers/${supplier.id}`, { isActive: !supplier.isActive })
      await loadSuppliers()
    } catch (err) {
      setError(t(`errors.${err.code}`, { defaultValue: t('suppliers.statusError') }))
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight text-slate-900"><Users className="h-6 w-6 text-teal-700" aria-hidden="true" />{t('nav.suppliers')}</h1>
          <p className="mt-1 text-sm text-slate-500">{t('suppliers.description')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {canManage && <label className="flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" checked={includeInactive} onChange={(e) => setIncludeInactive(e.target.checked)} className="rounded border-slate-300 text-teal-700 focus:ring-teal-600" />{t('suppliers.showInactive')}</label>}
          {canManage && <button type="button" onClick={openCreate} className="inline-flex items-center gap-2 rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-teal-800"><Plus className="h-4 w-4" aria-hidden="true" />{t('suppliers.add')}</button>}
        </div>
      </div>

      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" aria-hidden="true" />
        <input type="search" aria-label={t('suppliers.search')} placeholder={t('suppliers.search')} value={query} onChange={(e) => setQuery(e.target.value)}
          className="w-full rounded-xl border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-100" />
      </div>

      {error && !showModal && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800" role="alert">{error}</div>}
      {loading ? <p className="py-12 text-center text-sm text-slate-500" role="status">{t('common.loading')}</p>
        : suppliers.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">{t('suppliers.empty')}</div>
          : <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {suppliers.map((supplier) => <article key={supplier.id} className={`flex flex-col justify-between rounded-2xl border bg-white p-5 shadow-soft ${supplier.isActive ? 'border-slate-200' : 'border-amber-200 opacity-80'}`}>
              <div>
                <div className="flex items-start justify-between gap-3"><h2 className="text-sm font-extrabold text-slate-900">{supplier.name}</h2>
                  <span className={`shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-bold ${supplier.isActive ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>{supplier.isActive ? t('suppliers.active') : t('suppliers.inactive')}</span></div>
                {(supplier.contactName || supplier.contact) && <p className="mt-2 text-sm text-slate-600">{t('suppliers.contact')}: {supplier.contactName || supplier.contact}</p>}
                <div className="mt-4 space-y-2 text-sm text-slate-600">
                  {supplier.phone && <div className="flex items-center gap-2"><Phone className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" /><span>{supplier.phone}</span></div>}
                  {supplier.address && <div className="flex items-start gap-2"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" /><span>{supplier.address}</span></div>}
                  {supplier.tin && <p className="font-mono text-xs text-slate-500">{t('suppliers.tin')}: {supplier.tin}</p>}
                </div>
              </div>
              {canManage && <div className="mt-4 flex justify-end gap-4 border-t border-slate-100 pt-3 text-xs">
                <button type="button" onClick={() => openEdit(supplier)} className="font-semibold text-teal-800 underline-offset-2 hover:underline">{t('common.edit')}</button>
                <button type="button" onClick={() => toggleActive(supplier)} className="font-semibold text-slate-600 underline-offset-2 hover:underline">{supplier.isActive ? t('suppliers.deactivate') : t('suppliers.activate')}</button>
              </div>}
            </article>)}
          </div>}

      {showModal && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) setShowModal(false) }}>
        <section role="dialog" aria-modal="true" aria-labelledby="supplier-dialog-title" className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
          <div className="flex items-center justify-between"><h2 id="supplier-dialog-title" className="text-base font-extrabold text-slate-900">{editingSupplier ? t('suppliers.editTitle') : t('suppliers.addTitle')}</h2>
            <button type="button" onClick={() => setShowModal(false)} aria-label={t('common.cancel')} className="rounded-lg p-1 text-slate-500 hover:bg-slate-100"><X className="h-5 w-5" /></button></div>
          <form onSubmit={handleSave} className="mt-5 space-y-4">
            {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">{error}</div>}
            <div><label htmlFor="supplier-name" className="mb-1 block text-sm font-bold text-slate-700">{t('suppliers.name')} *</label><input id="supplier-name" required maxLength={150} autoFocus value={formData.name} onChange={(e) => setFormData((s) => ({ ...s, name: e.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-100" /></div>
            <div><label htmlFor="supplier-contact" className="mb-1 block text-sm font-bold text-slate-700">{t('suppliers.contact')}</label><input id="supplier-contact" maxLength={150} value={formData.contactName} onChange={(e) => setFormData((s) => ({ ...s, contactName: e.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-100" /></div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div><label htmlFor="supplier-phone" className="mb-1 block text-sm font-bold text-slate-700">{t('suppliers.phone')}</label><input id="supplier-phone" type="tel" autoComplete="tel" maxLength={30} value={formData.phone} onChange={(e) => setFormData((s) => ({ ...s, phone: e.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-100" /></div>
              <div><label htmlFor="supplier-tin" className="mb-1 block text-sm font-bold text-slate-700">{t('suppliers.tin')}</label><input id="supplier-tin" maxLength={50} value={formData.tin} onChange={(e) => setFormData((s) => ({ ...s, tin: e.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-100" /></div>
            </div>
            <div><label htmlFor="supplier-address" className="mb-1 block text-sm font-bold text-slate-700">{t('suppliers.address')}</label><input id="supplier-address" autoComplete="street-address" maxLength={255} value={formData.address} onChange={(e) => setFormData((s) => ({ ...s, address: e.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-100" /></div>
            <div className="flex justify-end gap-2 border-t border-slate-100 pt-4"><button type="button" onClick={() => setShowModal(false)} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50">{t('common.cancel')}</button>
              <button type="submit" disabled={submitting} className="inline-flex items-center gap-2 rounded-xl bg-teal-700 px-5 py-2 text-sm font-bold text-white hover:bg-teal-800 disabled:opacity-50"><Save className="h-4 w-4" aria-hidden="true" />{submitting ? t('common.loading') : t('common.save')}</button></div>
          </form>
        </section>
      </div>}
    </div>
  )
}
