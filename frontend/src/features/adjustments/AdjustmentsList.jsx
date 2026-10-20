import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../auth/AuthContext'
import { api } from '../../lib/api'
import { formatDate } from '../../lib/ethiopianDate'
import { Plus } from 'lucide-react'

export default function AdjustmentsList() {
  const { user, selectedBranchId } = useAuth()
  const { t, i18n } = useTranslation()

  const [adjustments, setAdjustments] = useState([])
  const [products, setProducts] = useState([])
  const [branches, setBranches] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [productLoadError, setProductLoadError] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [filters, setFilters] = useState({ productId: '', reason: '', from: '', to: '' })
  const [appliedFilters, setAppliedFilters] = useState({ productId: '', reason: '', from: '', to: '' })

  // Modal
  const [showModal, setShowModal] = useState(false)
  const [branchId, setBranchId] = useState('')
  const [productId, setProductId] = useState('')
  const [quantityChange, setQuantityChange] = useState('')
  const [reason, setReason] = useState('DAMAGE')
  const [note, setNote] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    loadAdjustments()
    api.get('/products', { limit: 100 }).then((r) => setProducts(Array.isArray(r?.data) ? r.data : [])).catch((err) => setProductLoadError(t(`errors.${err.code}`, { defaultValue: t('adjustments.productsLoadError') })))
    if (user?.role === 'ADMIN') api.get('/branches', { limit: 100 }).then((r) => setBranches(Array.isArray(r?.data) ? r.data : [])).catch(() => setBranches([]))
  }, [selectedBranchId, user?.role])

  const loadAdjustments = (nextPage = 1, activeFilters = appliedFilters) => {
    setLoading(true)
    setLoadError('')
    api.get('/adjustments', {
      branchId: user?.role === 'ADMIN' ? selectedBranchId : undefined,
      productId: activeFilters.productId || undefined,
      reason: activeFilters.reason || undefined,
      from: activeFilters.from || undefined,
      to: activeFilters.to || undefined,
      page: nextPage,
      limit: 20,
    })
      .then((res) => {
        setAdjustments(Array.isArray(res?.data) ? res.data : [])
        setPage(res?.page || nextPage)
        setTotal(Number(res?.total) || 0)
      })
      .catch((err) => setLoadError(t(`errors.${err.code}`, { defaultValue: t('adjustments.loadError') })))
      .finally(() => setLoading(false))
  }

  const handleFilterSubmit = (event) => {
    event.preventDefault()
    setAppliedFilters(filters)
    loadAdjustments(1, filters)
  }

  const clearFilters = () => {
    const emptyFilters = { productId: '', reason: '', from: '', to: '' }
    setFilters(emptyFilters)
    setAppliedFilters(emptyFilters)
    loadAdjustments(1, emptyFilters)
  }

  const handleCreateAdjustment = async (e) => {
    e.preventDefault()
    setErrorMsg('')

    if (!productId) {
      setErrorMsg(t('adjustments.productRequired'))
      return
    }
    if (user?.role === 'ADMIN' && !branchId) {
      setErrorMsg(t('adjustments.branchRequired'))
      return
    }
    const quantity = Number(quantityChange)
    if (!/^-?\d+(\.\d{1,2})?$/.test(quantityChange) || !Number.isFinite(quantity) || quantity === 0) {
      setErrorMsg(t('adjustments.invalidQuantity'))
      return
    }
    const negativeOnly = ['DAMAGE', 'EXPIRY', 'LOSS'].includes(reason)
    if ((negativeOnly && quantity >= 0) || (reason === 'OPENING_STOCK' && quantity <= 0)) {
      setErrorMsg(negativeOnly ? t('adjustments.negativeRequired') : t('adjustments.positiveRequired'))
      return
    }

    setSubmitting(true)
    try {
      await api.post('/adjustments', {
        ...(user?.role === 'ADMIN' ? { branchId: Number(branchId) } : { branchId: user?.branchId }),
        productId: Number(productId),
        quantity,
        reason,
        ...(note.trim() ? { note: note.trim() } : {}),
      })
      setShowModal(false)
      setProductId('')
      setQuantityChange('')
      setNote('')
      loadAdjustments(page)
    } catch (err) {
      setErrorMsg(err.code === 'INSUFFICIENT_STOCK'
        ? t('adjustments.insufficientStock')
        : t(`errors.${err.code}`, { defaultValue: t('adjustments.createError') }))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            {t('adjustments.title')}
          </h1>
          <p className="text-xs text-slate-500 mt-1">{t('adjustments.description')}</p>
        </div>

        {user?.role !== 'AUDITOR' && (
          <button
            onClick={() => { setShowModal(true); setErrorMsg(''); setBranchId(user?.role === 'ADMIN' ? String(selectedBranchId || '') : String(user?.branchId || '')); setReason('DAMAGE'); setNote(''); }}
            className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-blue-700 transition"
          >
            <Plus className="h-4 w-4" />
            {t('adjustments.newAdjustment')}
          </button>
        )}
      </div>

      <form onSubmit={handleFilterSubmit} className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-6">
        <label className="text-xs font-bold text-slate-700">{t('adjustments.product')}<select value={filters.productId} onChange={(event) => setFilters((previous) => ({ ...previous, productId: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"><option value="">{t('adjustments.allProducts')}</option>{products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</select></label>
        <label className="text-xs font-bold text-slate-700">{t('adjustments.reason')}<select value={filters.reason} onChange={(event) => setFilters((previous) => ({ ...previous, reason: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"><option value="">{t('adjustments.allReasons')}</option>{['DAMAGE', 'EXPIRY', 'LOSS', 'RECOUNT', 'OPENING_STOCK', 'OTHER'].map((value) => <option key={value} value={value}>{t(`reasons.${value}`)}</option>)}</select></label>
        <label className="text-xs font-bold text-slate-700">{t('sales.from')}<input type="date" value={filters.from} max={filters.to || undefined} onChange={(event) => setFilters((previous) => ({ ...previous, from: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" /></label>
        <label className="text-xs font-bold text-slate-700">{t('sales.to')}<input type="date" value={filters.to} min={filters.from || undefined} onChange={(event) => setFilters((previous) => ({ ...previous, to: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" /></label>
        <button type="submit" className="self-end rounded-lg bg-teal-700 px-4 py-2 text-sm font-bold text-white hover:bg-teal-800">{t('sales.applyFilters')}</button>
        <button type="button" onClick={clearFilters} className="self-end rounded-lg border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50">{t('sales.clearFilters')}</button>
      </form>

      {/* Adjustments Table */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-soft overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase text-[11px] font-bold">
              <tr>
                <th className="py-3 px-4">{t('sales.date')}</th>
                <th className="py-3 px-4">{t('adjustments.product')}</th>
                <th className="py-3 px-4">{t('adjustments.branch')}</th>
                <th className="py-3 px-4 text-center">{t('adjustments.change')}</th>
                <th className="py-3 px-4">{t('adjustments.reason')}</th>
                <th className="py-3 px-4">{t('adjustments.notes')}</th>
                <th className="py-3 px-4">{t('adjustments.loggedBy')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
              {loading ? (
                <tr>
                  <td colSpan="7" className="py-8 text-center text-slate-400">
                    {t('common.loading')}
                  </td>
                </tr>
              ) : loadError ? (
                <tr><td colSpan="7" className="py-8 text-center text-red-700">{loadError} <button type="button" onClick={() => loadAdjustments(page)} className="font-bold underline">{t('common.retry')}</button></td></tr>
              ) : adjustments.length === 0 ? (
                <tr>
                  <td colSpan="7" className="py-8 text-center text-slate-400">
                    {t('adjustments.noMatches')}
                  </td>
                </tr>
              ) : (
                adjustments.map((a) => (
                  <tr key={a.id} className="hover:bg-slate-50/70">
                    <td className="py-3 px-4 text-slate-500">{formatDate(a.createdAt, i18n.language)}</td>
                    <td className="py-3 px-4 font-bold text-slate-900">{a.productName}</td>
                    <td className="py-3 px-4 font-semibold text-slate-700">{a.branchName}</td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-extrabold ${
                          (a.quantity ?? a.quantityChange) > 0
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-red-50 text-red-700'
                        }`}
                      >
                        {(a.quantity ?? a.quantityChange) > 0 ? `+${a.quantity ?? a.quantityChange}` : (a.quantity ?? a.quantityChange)}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-800">
                      {t(`reasons.${a.reason}`, a.reason)}
                    </td>
                    <td className="py-3 px-4 text-slate-500 max-w-xs truncate">{a.note || a.notes || '—'}</td>
                    <td className="py-3 px-4 text-slate-600">{a.createdBy?.name || a.createdByName || '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {!loading && !loadError && total > 20 && <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-sm text-slate-600"><span>{t('adjustments.pageSummary', { page, pageCount: Math.ceil(total / 20), total })}</span><div className="flex gap-2"><button type="button" disabled={page <= 1} onClick={() => loadAdjustments(page - 1)} className="rounded-lg border border-slate-300 px-3 py-1.5 font-semibold disabled:opacity-40">{t('common.previous')}</button><button type="button" disabled={page >= Math.ceil(total / 20)} onClick={() => loadAdjustments(page + 1)} className="rounded-lg border border-slate-300 px-3 py-1.5 font-semibold disabled:opacity-40">{t('common.next')}</button></div></div>}
      </div>

      {/* New Adjustment Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl max-h-[90vh] overflow-y-auto" role="dialog" aria-modal="true" aria-labelledby="adjustment-form-title">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 id="adjustment-form-title" className="font-extrabold text-base text-slate-900">{t('adjustments.newAdjustment')}</h3>
              <button type="button" onClick={() => setShowModal(false)} aria-label={t('common.close')} className="text-slate-400 hover:text-slate-600 font-bold">
                ✕
              </button>
            </div>

            {errorMsg && (
                <div role="alert" className="mt-3 rounded-lg bg-red-50 p-2.5 text-xs font-semibold text-red-700 border border-red-200">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleCreateAdjustment} className="mt-4 space-y-3.5 text-xs">
              {user?.role === 'ADMIN' ? <div>
                <label className="block font-bold text-slate-700 mb-1">{t('adjustments.branch')}</label>
                <select
                  required
                  value={branchId}
                  onChange={(e) => setBranchId(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-blue-500 focus:outline-none"
                >
                  <option value="">{t('adjustments.selectBranch')}</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div> : <div><span className="block font-bold text-slate-700 mb-1">{t('adjustments.branch')}</span><p className="rounded-lg bg-slate-50 px-3 py-2 text-slate-700">{user?.branchName || t('adjustments.assignedBranch')}</p></div>}

              {productLoadError && <p role="alert" className="text-red-700">{productLoadError}</p>}

              <div>
                <label className="block font-bold text-slate-700 mb-1">{t('adjustments.product')} *</label>
                <select
                  required
                  value={productId}
                  onChange={(e) => setProductId(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-blue-500 focus:outline-none"
                >
                  <option value="">{t('adjustments.selectProduct')}</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">{t('adjustments.reason')} *</label>
                  <select
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-blue-500 focus:outline-none"
                  >
                    <option value="DAMAGE">{t('adjustments.damage')}</option>
                    <option value="EXPIRY">{t('adjustments.expiry')}</option>
                    <option value="LOSS">{t('adjustments.loss')}</option>
                    <option value="RECOUNT">{t('adjustments.recount')}</option>
                    <option value="OPENING_STOCK">{t('adjustments.openingStock')}</option>
                    <option value="OTHER">{t('adjustments.other')}</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    {t('adjustments.change')} *
                  </label>
                  <input
                    type="number"
                    required
                    step="0.01"
                    min={reason === 'OPENING_STOCK' ? '0.01' : undefined}
                    max={['DAMAGE', 'EXPIRY', 'LOSS'].includes(reason) ? '-0.01' : undefined}
                    value={quantityChange}
                    onChange={(e) => setQuantityChange(e.target.value)}
                    placeholder={t('adjustments.quantityPlaceholder')}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-blue-500 focus:outline-none font-bold text-center"
                  />
                </div>
              </div>

              <p className="rounded-lg bg-slate-50 p-2 text-[11px] text-slate-600">{['DAMAGE', 'EXPIRY', 'LOSS'].includes(reason) ? t('adjustments.negativeRequired') : reason === 'OPENING_STOCK' ? t('adjustments.positiveRequired') : t('adjustments.signedAllowed')}</p>

              <div>
                <label className="block font-bold text-slate-700 mb-1">{t('adjustments.notes')}</label>
                <textarea
                  rows="3"
                  maxLength={300}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder={t('adjustments.notePlaceholder')}
                  className="w-full rounded-lg border border-slate-300 p-2.5 text-xs focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div className="mt-6 flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="rounded-xl border border-slate-300 px-4 py-2 font-bold text-slate-600 hover:bg-slate-50"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-xl bg-blue-600 px-5 py-2 font-bold text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {submitting ? t('common.loading') : t('common.confirm')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
