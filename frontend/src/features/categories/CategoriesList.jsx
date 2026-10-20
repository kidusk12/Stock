import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../auth/AuthContext'
import { api } from '../../lib/api'
import { FolderTree, Plus, Save, X } from 'lucide-react'

export default function CategoriesList() {
  const { user } = useAuth()
  const { t } = useTranslation()
  const isAdmin = user?.role === 'ADMIN'
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [includeInactive, setIncludeInactive] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [editingCategory, setEditingCategory] = useState(null)
  const [name, setName] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const loadCategories = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const result = await api.get('/categories', { includeInactive: includeInactive || undefined, limit: 100 })
      setCategories(result.data || [])
    } catch (err) {
      setError(t(`errors.${err.code}`, { defaultValue: t('categories.loadError') }))
    } finally {
      setLoading(false)
    }
  }, [includeInactive, t])

  useEffect(() => { loadCategories() }, [loadCategories])

  const openCreate = () => {
    setEditingCategory(null)
    setName('')
    setError('')
    setShowModal(true)
  }

  const openEdit = (category) => {
    setEditingCategory(category)
    setName(category.name || '')
    setError('')
    setShowModal(true)
  }

  const handleSave = async (event) => {
    event.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      const payload = { name: name.trim() }
      if (editingCategory) await api.patch(`/categories/${editingCategory.id}`, payload)
      else await api.post('/categories', payload)
      setShowModal(false)
      await loadCategories()
    } catch (err) {
      setError(t(`errors.${err.code}`, { defaultValue: t('categories.saveError') }))
    } finally {
      setSubmitting(false)
    }
  }

  const toggleActive = async (category) => {
    setError('')
    try {
      await api.patch(`/categories/${category.id}`, { isActive: !category.isActive })
      await loadCategories()
    } catch (err) {
      setError(t(`errors.${err.code}`, { defaultValue: t('categories.statusError') }))
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight text-slate-900"><FolderTree className="h-6 w-6 text-teal-700" aria-hidden="true" />{t('nav.categories')}</h1>
          <p className="mt-1 text-sm text-slate-500">{t('categories.description')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {isAdmin && <label className="flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" checked={includeInactive} onChange={(e) => setIncludeInactive(e.target.checked)} className="rounded border-slate-300 text-teal-700 focus:ring-teal-600" />
            {t('categories.showInactive')}
          </label>}
          {isAdmin && <button type="button" onClick={openCreate} className="inline-flex items-center gap-2 rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-teal-800"><Plus className="h-4 w-4" aria-hidden="true" />{t('categories.add')}</button>}
        </div>
      </div>

      {error && !showModal && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800" role="alert">{error}</div>}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-soft">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs font-bold uppercase text-slate-600">
            <tr><th scope="col" className="px-4 py-3">{t('categories.name')}</th><th scope="col" className="px-4 py-3 text-center">{t('common.status')}</th>{isAdmin && <th scope="col" className="px-4 py-3 text-right">{t('common.actions')}</th>}</tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-700">
            {loading ? <tr><td colSpan={isAdmin ? 3 : 2} className="px-4 py-10 text-center text-slate-500" role="status">{t('common.loading')}</td></tr>
              : categories.length === 0 ? <tr><td colSpan={isAdmin ? 3 : 2} className="px-4 py-10 text-center text-slate-500">{t('categories.empty')}</td></tr>
                : categories.map((category) => (
                  <tr key={category.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-semibold">{category.name}</td>
                    <td className="px-4 py-3 text-center"><span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-bold ${category.isActive ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>{category.isActive ? t('categories.active') : t('categories.inactive')}</span></td>
                    {isAdmin && <td className="px-4 py-3 text-right"><div className="flex justify-end gap-4">
                      <button type="button" onClick={() => openEdit(category)} className="font-semibold text-teal-800 underline-offset-2 hover:underline">{t('common.edit')}</button>
                      <button type="button" onClick={() => toggleActive(category)} className="font-semibold text-slate-600 underline-offset-2 hover:underline">{category.isActive ? t('categories.deactivate') : t('categories.activate')}</button>
                    </div></td>}
                  </tr>
                ))}
          </tbody>
        </table>
      </div>

      {showModal && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) setShowModal(false) }}>
        <section role="dialog" aria-modal="true" aria-labelledby="category-dialog-title" className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
          <div className="flex items-center justify-between"><h2 id="category-dialog-title" className="text-base font-extrabold text-slate-900">{editingCategory ? t('categories.editTitle') : t('categories.addTitle')}</h2>
            <button type="button" onClick={() => setShowModal(false)} aria-label={t('common.cancel')} className="rounded-lg p-1 text-slate-500 hover:bg-slate-100"><X className="h-5 w-5" /></button></div>
          <form onSubmit={handleSave} className="mt-5 space-y-4">
            {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">{error}</div>}
            <div><label htmlFor="category-name" className="mb-1 block text-sm font-bold text-slate-700">{t('categories.name')} *</label>
              <input id="category-name" name="name" type="text" required maxLength={100} autoFocus value={name} onChange={(e) => setName(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-100" /></div>
            <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
              <button type="button" onClick={() => setShowModal(false)} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50">{t('common.cancel')}</button>
              <button type="submit" disabled={submitting} className="inline-flex items-center gap-2 rounded-xl bg-teal-700 px-5 py-2 text-sm font-bold text-white hover:bg-teal-800 disabled:opacity-50"><Save className="h-4 w-4" aria-hidden="true" />{submitting ? t('common.loading') : t('common.save')}</button>
            </div>
          </form>
        </section>
      </div>}
    </div>
  )
}
