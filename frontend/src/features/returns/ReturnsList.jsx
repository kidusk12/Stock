import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../auth/AuthContext'
import { api } from '../../lib/api'
import { formatETB, formatDate } from '../../lib/ethiopianDate'
import {
  CheckCircle2,
  DollarSign,
  Plus
} from 'lucide-react'

export default function ReturnsList() {
  const { user, selectedBranchId } = useAuth()
  const { t, i18n } = useTranslation()

  const [returns, setReturns] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [actionError, setActionError] = useState('')
  const [refundLoadingId, setRefundLoadingId] = useState(null)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [filters, setFilters] = useState({ refundStatus: '', from: '', to: '' })
  const [appliedFilters, setAppliedFilters] = useState({ refundStatus: '', from: '', to: '' })

  // New Return Modal State
  const [showModal, setShowModal] = useState(false)
  const [invoiceQuery, setInvoiceQuery] = useState('')
  const [foundSale, setFoundSale] = useState(null)
  const [returnItems, setReturnItems] = useState({}) // saleItemId -> qty
  const [returnReason, setReturnReason] = useState('')
  const [returnError, setReturnError] = useState('')
  const [returnNotice, setReturnNotice] = useState('')
  const [invoiceLoading, setInvoiceLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    loadReturns()
  }, [selectedBranchId])

  const loadReturns = (nextPage = 1, activeFilters = appliedFilters) => {
    setLoading(true)
    setLoadError('')
    api.get('/returns', {
      branchId: user?.role === 'ADMIN' ? selectedBranchId : undefined,
      refundStatus: activeFilters.refundStatus || undefined,
      from: activeFilters.from || undefined,
      to: activeFilters.to || undefined,
      page: nextPage,
      limit: 20,
    })
      .then((res) => {
        setReturns(Array.isArray(res?.data) ? res.data : [])
        setPage(res?.page || nextPage)
        setTotal(Number(res?.total) || 0)
      })
      .catch((err) => setLoadError(t(`errors.${err.code}`, { defaultValue: t('returns.loadError') })))
      .finally(() => setLoading(false))
  }

  const handleFilterSubmit = (event) => {
    event.preventDefault()
    setAppliedFilters(filters)
    loadReturns(1, filters)
  }

  const clearFilters = () => {
    const emptyFilters = { refundStatus: '', from: '', to: '' }
    setFilters(emptyFilters)
    setAppliedFilters(emptyFilters)
    loadReturns(1, emptyFilters)
  }

  const handleSearchInvoice = async (e) => {
    e.preventDefault()
    if (!invoiceQuery.trim()) return
    setReturnError('')
    setReturnNotice('')
    setFoundSale(null)
    setInvoiceLoading(true)

    try {
      const salesRes = await api.get('/sales', {
        branchId: user?.role === 'ADMIN' ? selectedBranchId : undefined,
        invoiceNumber: invoiceQuery.trim(),
        limit: 100,
      })
      const saleSummary = (salesRes.data || []).find(
        (sale) => sale.invoiceNumber?.toLowerCase() === invoiceQuery.trim().toLowerCase()
      )
      if (!saleSummary) {
        setReturnError(t('returns.invoiceNotFound'))
        return
      }
      const sale = await api.get(`/sales/${saleSummary.id}`)
      setFoundSale(sale)
      const init = {}
      sale.items.forEach((item) => { init[item.id] = '0' })
      setReturnItems(init)
    } catch (err) {
      setReturnError(t(`errors.${err.code}`, { defaultValue: t('returns.invoiceLoadError') }))
    } finally {
      setInvoiceLoading(false)
    }
  }

  const handleCreateReturn = async (e) => {
    e.preventDefault()
    if (!foundSale) return
    setReturnError('')

    const itemsToSubmit = foundSale.items
      .map((saleItem) => {
        const remaining = Math.max(0, Number(saleItem.quantity) - Number(saleItem.returnedQuantity || 0))
        const rawQuantity = returnItems[saleItem.id] || '0'
        return { saleItemId: Number(saleItem.id), quantity: Number(rawQuantity), remaining, rawQuantity }
      })
      .filter((item) => item.quantity > 0)

    if (itemsToSubmit.length === 0) {
      setReturnError(t('returns.enterReturnQuantity'))
      return
    }
    if (itemsToSubmit.some((item) => !/^\d+(\.\d{1,2})?$/.test(item.rawQuantity) || item.quantity <= 0 || item.quantity > item.remaining)) {
      setReturnError(t('returns.invalidReturnQuantity'))
      return
    }

    setSubmitting(true)
    try {
      const createdReturn = await api.post(`/sales/${foundSale.id}/returns`, {
        reason: returnReason.trim() || undefined,
        items: itemsToSubmit.map(({ saleItemId, quantity }) => ({ saleItemId, quantity })),
      })
      setReturnNotice(t('returns.createdNotice', { returnNumber: createdReturn.returnNumber }))
      setShowModal(false)
      setFoundSale(null)
      setInvoiceQuery('')
      setReturnItems({})
      setReturnReason('')
      const emptyFilters = { refundStatus: '', from: '', to: '' }
      setFilters(emptyFilters)
      setAppliedFilters(emptyFilters)
      loadReturns(1, emptyFilters)
    } catch (err) {
      if (err.code === 'RETURN_EXCEEDS_SOLD') {
        try {
          const latestSale = await api.get(`/sales/${foundSale.id}`)
          setFoundSale(latestSale)
          setReturnItems((previous) => Object.fromEntries(latestSale.items.map((item) => {
            const remaining = Math.max(0, Number(item.quantity) - Number(item.returnedQuantity || 0))
            return [item.id, String(Math.min(Number(previous[item.id] || 0), remaining))]
          })))
        } catch {
          // Keep the current invoice visible; the next search will fetch its latest returnable quantities.
        }
        setReturnError(t('returns.returnLimitChanged'))
      } else {
        setReturnError(t(`errors.${err.code}`, { defaultValue: t('returns.createError') }))
      }
    } finally {
      setSubmitting(false)
    }
  }

  const handleMarkRefunded = async (returnId) => {
    setActionError('')
    setRefundLoadingId(returnId)
    try {
      await api.patch(`/returns/${returnId}/refund`)
      loadReturns(appliedFilters.refundStatus === 'PENDING_REFUND' ? 1 : page)
    } catch (err) {
      setActionError(t(`errors.${err.code}`, { defaultValue: t('returns.refundError') }))
    } finally {
      setRefundLoadingId(null)
    }
  }

  const hasReturnableItems = foundSale?.items?.some((item) => Number(item.quantity) > Number(item.returnedQuantity || 0))

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            {t('returns.title')}
          </h1>
          <p className="text-xs text-slate-500 mt-1">{t('returns.description')}</p>
        </div>

        {user?.role !== 'AUDITOR' && (
          <button
            onClick={() => { setShowModal(true); setFoundSale(null); setReturnError(''); setReturnNotice(''); setReturnReason(''); }}
            className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-blue-700 transition"
          >
            <Plus className="h-4 w-4" />
            {t('returns.newReturn')}
          </button>
        )}
      </div>

      {returnNotice && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{returnNotice}</div>}
      {actionError && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{actionError}</div>}

      <form onSubmit={handleFilterSubmit} className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-5">
        <label className="text-xs font-bold text-slate-700">
          {t('returns.refundStatus')}
          <select value={filters.refundStatus} onChange={(event) => setFilters((previous) => ({ ...previous, refundStatus: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
            <option value="">{t('returns.allStatuses')}</option>
            <option value="PENDING_REFUND">{t('returns.pending')}</option>
            <option value="REFUNDED">{t('returns.refunded')}</option>
          </select>
        </label>
        <label className="text-xs font-bold text-slate-700">
          {t('sales.from')}
          <input type="date" value={filters.from} max={filters.to || undefined} onChange={(event) => setFilters((previous) => ({ ...previous, from: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </label>
        <label className="text-xs font-bold text-slate-700">
          {t('sales.to')}
          <input type="date" value={filters.to} min={filters.from || undefined} onChange={(event) => setFilters((previous) => ({ ...previous, to: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </label>
        <button type="submit" className="self-end rounded-lg bg-teal-700 px-4 py-2 text-sm font-bold text-white hover:bg-teal-800">{t('sales.applyFilters')}</button>
        <button type="button" onClick={clearFilters} className="self-end rounded-lg border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50">{t('sales.clearFilters')}</button>
      </form>

      {/* Returns Table */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-soft overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase text-[11px] font-bold">
              <tr>
                <th className="py-3.5 px-4">{t('returns.returnNumber')}</th>
                <th className="py-3.5 px-4">{t('sales.invoiceNo')}</th>
                <th className="py-3.5 px-4">{t('sales.date')}</th>
                <th className="py-3.5 px-4">{t('returns.branch')}</th>
                <th className="py-3.5 px-4">{t('returns.returnReason')}</th>
                <th className="py-3.5 px-4 text-right">{t('returns.refundAmount')}</th>
                <th className="py-3.5 px-4 text-center">{t('returns.refundStatus')}</th>
                {user?.role !== 'AUDITOR' && (
                  <th className="py-3.5 px-4 text-center">{t('common.actions')}</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
              {loading ? (
                <tr>
                  <td colSpan={user?.role === 'AUDITOR' ? 7 : 8} className="py-8 text-center text-slate-400">
                    {t('common.loading')}
                  </td>
                </tr>
              ) : loadError ? (
                <tr>
                  <td colSpan={user?.role === 'AUDITOR' ? 7 : 8} className="py-8 text-center text-red-700">
                    {loadError} <button type="button" onClick={() => loadReturns(page)} className="font-bold underline">{t('common.retry')}</button>
                  </td>
                </tr>
              ) : returns.length === 0 ? (
                <tr>
                  <td colSpan={user?.role === 'AUDITOR' ? 7 : 8} className="py-8 text-center text-slate-400">
                    {t('returns.noMatches')}
                  </td>
                </tr>
              ) : (
                returns.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/70">
                    <td className="py-3 px-4 font-mono font-bold text-slate-900">{r.returnNumber}</td>
                    <td className="py-3 px-4 font-mono font-bold text-blue-600">{r.invoiceNumber}</td>
                    <td className="py-3 px-4 text-slate-500">{formatDate(r.createdAt, i18n.language)}</td>
                    <td className="py-3 px-4">{r.branchName}</td>
                    <td className="py-3 px-4 text-slate-600">{r.reason || '—'}</td>
                    <td className="py-3 px-4 text-right font-extrabold text-slate-900">
                      {formatETB(r.refundAmount, i18n.language)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                          r.refundStatus === 'REFUNDED'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}
                      >
                        {r.refundStatus === 'REFUNDED' ? t('returns.refunded') : t('returns.pending')}
                      </span>
                    </td>
                    {user?.role !== 'AUDITOR' && (
                      <td className="py-3 px-4 text-center">
                        {r.refundStatus === 'PENDING_REFUND' ? (
                          <button
                            onClick={() => handleMarkRefunded(r.id)}
                            disabled={refundLoadingId === r.id}
                            className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-emerald-700 transition disabled:opacity-50"
                          >
                            <DollarSign className="h-3 w-3" />
                            {refundLoadingId === r.id ? t('common.loading') : t('returns.markRefunded')}
                          </button>
                        ) : (
                          <span className="text-slate-400 text-[11px] font-medium flex items-center justify-center gap-1">
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                            {t('returns.refunded')}
                          </span>
                        )}
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {!loading && !loadError && total > 20 && <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-sm text-slate-600"><span>{t('returns.pageSummary', { page, pageCount: Math.ceil(total / 20), total })}</span><div className="flex gap-2"><button type="button" disabled={page <= 1} onClick={() => loadReturns(page - 1)} className="rounded-lg border border-slate-300 px-3 py-1.5 font-semibold disabled:opacity-40">{t('common.previous')}</button><button type="button" disabled={page >= Math.ceil(total / 20)} onClick={() => loadReturns(page + 1)} className="rounded-lg border border-slate-300 px-3 py-1.5 font-semibold disabled:opacity-40">{t('common.next')}</button></div></div>}
      </div>

      {/* Process Return Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl max-h-[90vh] overflow-y-auto" role="dialog" aria-modal="true" aria-labelledby="return-form-title">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 id="return-form-title" className="font-extrabold text-base text-slate-900">{t('returns.newReturn')}</h3>
              <button type="button" onClick={() => setShowModal(false)} aria-label={t('common.close')} className="text-slate-400 hover:text-slate-600 font-bold">
                ✕
              </button>
            </div>

            {/* Step 1: Find Invoice */}
            <form onSubmit={handleSearchInvoice} className="mt-4">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {t('returns.invoiceSearch')}
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  required
                  value={invoiceQuery}
                  onChange={(e) => setInvoiceQuery(e.target.value)}
                  placeholder={t('returns.invoicePlaceholder')}
                  className="flex-1 rounded-xl border border-slate-300 px-3 py-2 text-xs font-mono focus:border-blue-500 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={invoiceLoading}
                  className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700"
                >
                  {invoiceLoading ? t('common.loading') : t('common.search')}
                </button>
              </div>
            </form>

            {returnError && (
              <div role="alert" className="mt-3 rounded-lg bg-red-50 p-2.5 text-xs font-semibold text-red-700 border border-red-200">
                {returnError}
              </div>
            )}

            {/* Step 2: Invoice Items & Quantities */}
            {foundSale && (
              <form onSubmit={handleCreateReturn} className="mt-4 space-y-4 text-xs">
                <div className="rounded-xl bg-slate-50 p-3 border border-slate-200">
                  <div className="flex justify-between font-bold text-slate-800">
                    <span>{foundSale.invoiceNumber}</span>
                    <span className="text-emerald-700">{formatETB(foundSale.total, i18n.language)}</span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {foundSale.customerName || t('sales.walkInCustomer')} · {formatDate(foundSale.createdAt, i18n.language)}
                  </p>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-2">
                    {t('returns.selectReturnItems')}
                  </label>
                  {!hasReturnableItems && <p role="status" className="mb-2 rounded-lg bg-slate-50 p-2 text-slate-600">{t('returns.allItemsReturned')}</p>}
                  <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                    {foundSale.items.map((it) => (
                      <div key={it.id} className="p-3 flex items-center justify-between bg-white">
                        <div>
                          <p className="font-bold text-slate-800">{it.productName || it.name}</p>
                          <p className="text-[10px] text-slate-400">{t('returns.soldQuantity')}: {it.quantity} @ {formatETB(it.unitPrice, i18n.language)}</p>
                          <p className="text-[10px] text-slate-400">{t('returns.alreadyReturned')}: {it.returnedQuantity || 0} · {t('returns.returnableQuantity')}: {Math.max(0, Number(it.quantity) - Number(it.returnedQuantity || 0))}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-slate-500 text-[11px]">{t('returns.returnQty')}:</span>
                          <input
                            type="number"
                            min="0"
                            max={Math.max(0, Number(it.quantity) - Number(it.returnedQuantity || 0))}
                            step="0.01"
                            value={returnItems[it.id] ?? '0'}
                            disabled={Number(it.quantity) <= Number(it.returnedQuantity || 0)}
                            aria-label={t('returns.returnQuantityFor', { product: it.productName || it.name })}
                            onChange={(e) => setReturnItems((previous) => ({ ...previous, [it.id]: e.target.value }))}
                            className="w-16 rounded-lg border border-slate-300 px-2 py-1 text-center font-bold text-xs focus:border-blue-500 focus:outline-none"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">{t('returns.returnReason')}</label>
                  <input
                    type="text"
                    value={returnReason}
                    onChange={(e) => setReturnReason(e.target.value)}
                    maxLength={300}
                    placeholder={t('returns.reasonPlaceholder')}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-blue-500 focus:outline-none"
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
                    disabled={submitting || !hasReturnableItems}
                    className="rounded-xl bg-blue-600 px-5 py-2 font-bold text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    {submitting ? t('common.loading') : t('common.confirm')}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
