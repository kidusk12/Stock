import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../auth/AuthContext'
import { api } from '../../lib/api'
import { formatETB, formatDate } from '../../lib/ethiopianDate'
import {
  RotateCcw,
  Search,
  CheckCircle2,
  AlertCircle,
  FileText,
  DollarSign,
  Plus
} from 'lucide-react'

export default function ReturnsList() {
  const { user, selectedBranchId } = useAuth()
  const { t, i18n } = useTranslation()
  const isAm = i18n.language === 'am'

  const [returns, setReturns] = useState([])
  const [loading, setLoading] = useState(true)

  // New Return Modal State
  const [showModal, setShowModal] = useState(false)
  const [invoiceQuery, setInvoiceQuery] = useState('')
  const [foundSale, setFoundSale] = useState(null)
  const [returnItems, setReturnItems] = useState({}) // productId -> qty
  const [returnReason, setReturnReason] = useState('Customer Return')
  const [returnError, setReturnError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    loadReturns()
  }, [selectedBranchId])

  const loadReturns = () => {
    setLoading(true)
    api.get('/returns', { branchId: selectedBranchId })
      .then((res) => setReturns(res.data || []))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false))
  }

  const handleSearchInvoice = async (e) => {
    e.preventDefault()
    if (!invoiceQuery.trim()) return
    setReturnError('')
    setFoundSale(null)

    try {
      const salesRes = await api.get('/sales', { branchId: selectedBranchId })
      const sale = (salesRes.data || []).find(
        (s) => s.invoiceNumber.toLowerCase() === invoiceQuery.trim().toLowerCase()
      )
      if (!sale) {
        setReturnError(t('errors.NOT_FOUND', 'Invoice not found'))
        return
      }
      setFoundSale(sale)
      // Initialize return quantities to 0
      const init = {}
      sale.items.forEach((it) => { init[it.productId] = 0 })
      setReturnItems(init)
    } catch {
      setReturnError(t('errors.NOT_FOUND', 'Invoice not found'))
    }
  }

  const handleCreateReturn = async (e) => {
    e.preventDefault()
    if (!foundSale) return
    setReturnError('')

    const itemsToSubmit = Object.entries(returnItems)
      .map(([productId, qty]) => ({ productId: Number(productId), quantity: Number(qty) }))
      .filter((i) => i.quantity > 0)

    if (itemsToSubmit.length === 0) {
      setReturnError(isAm ? 'እባክዎ ቢያንስ የአንድ ዕቃ መመለሻ ብዛት ያስገቡ' : 'Please specify return quantity for at least one item')
      return
    }

    setSubmitting(true)
    try {
      await api.post('/returns', {
        saleId: foundSale.id,
        invoiceNumber: foundSale.invoiceNumber,
        reason: returnReason,
        items: itemsToSubmit,
      })
      setShowModal(false)
      setFoundSale(null)
      setInvoiceQuery('')
      loadReturns()
    } catch (err) {
      setReturnError(err.message || t(`errors.${err.code}`, 'Failed to process return'))
    } finally {
      setSubmitting(false)
    }
  }

  const handleMarkRefunded = async (returnId) => {
    try {
      await api.patch(`/returns/${returnId}/refund`)
      loadReturns()
    } catch (err) {
      alert(err.message || 'Error refunding')
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            {t('returns.title')}
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            {isAm ? 'የተመለሱ ዕቃዎችን ወደ ክምችት መመለሻ እና የገንዘብ ተመላሽ መቆጣጠሪያ' : 'Customer return processing, inventory restocking, and refund management'}
          </p>
        </div>

        {user?.role !== 'AUDITOR' && (
          <button
            onClick={() => { setShowModal(true); setFoundSale(null); setReturnError(''); }}
            className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-blue-700 transition"
          >
            <Plus className="h-4 w-4" />
            {t('returns.newReturn')}
          </button>
        )}
      </div>

      {/* Returns Table */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-soft overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase text-[11px] font-bold">
              <tr>
                <th className="py-3.5 px-4">{isAm ? 'የተመላሽ ቁጥር' : 'Return #'}</th>
                <th className="py-3.5 px-4">{t('sales.invoiceNo')}</th>
                <th className="py-3.5 px-4">{t('sales.date')}</th>
                <th className="py-3.5 px-4">{isAm ? 'ቅርንጫፍ' : 'Branch'}</th>
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
                  <td colSpan="8" className="py-8 text-center text-slate-400">
                    {t('common.loading')}
                  </td>
                </tr>
              ) : returns.length === 0 ? (
                <tr>
                  <td colSpan="8" className="py-8 text-center text-slate-400">
                    {t('common.noData')}
                  </td>
                </tr>
              ) : (
                returns.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/70">
                    <td className="py-3 px-4 font-mono font-bold text-slate-900">{r.returnNumber}</td>
                    <td className="py-3 px-4 font-mono font-bold text-blue-600">{r.invoiceNumber}</td>
                    <td className="py-3 px-4 text-slate-500">{formatDate(r.createdAt, i18n.language)}</td>
                    <td className="py-3 px-4">{r.branchName}</td>
                    <td className="py-3 px-4 text-slate-600">{r.reason}</td>
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
                            className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-emerald-700 transition"
                          >
                            <DollarSign className="h-3 w-3" />
                            {t('returns.markRefunded')}
                          </button>
                        ) : (
                          <span className="text-slate-400 text-[11px] font-medium flex items-center justify-center gap-1">
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                            {isAm ? 'ተጠናቋል' : 'Done'}
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
      </div>

      {/* Process Return Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-extrabold text-base text-slate-900">{t('returns.newReturn')}</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 font-bold">
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
                  placeholder="e.g. INV-2026-1039"
                  className="flex-1 rounded-xl border border-slate-300 px-3 py-2 text-xs font-mono focus:border-blue-500 focus:outline-none"
                />
                <button
                  type="submit"
                  className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700"
                >
                  {t('common.search')}
                </button>
              </div>
            </form>

            {returnError && (
              <div className="mt-3 rounded-lg bg-red-50 p-2.5 text-xs font-semibold text-red-700 border border-red-200">
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
                    Customer: {foundSale.customerName} · {formatDate(foundSale.createdAt, i18n.language)}
                  </p>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-2">
                    {isAm ? 'የሚመለሱ ዕቃዎችን ብዛት ያስገቡ:' : 'Select items and return quantities:'}
                  </label>
                  <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                    {foundSale.items.map((it) => (
                      <div key={it.productId} className="p-3 flex items-center justify-between bg-white">
                        <div>
                          <p className="font-bold text-slate-800">{it.productName}</p>
                          <p className="text-[10px] text-slate-400">Sold: {it.quantity} @ {formatETB(it.unitPrice, i18n.language)}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-slate-500 text-[11px]">{t('returns.returnQty')}:</span>
                          <input
                            type="number"
                            min="0"
                            max={it.quantity}
                            value={returnItems[it.productId] || 0}
                            onChange={(e) =>
                              setReturnItems({
                                ...returnItems,
                                [it.productId]: Math.min(Number(it.quantity), Math.max(0, Number(e.target.value))),
                              })
                            }
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
                    required
                    value={returnReason}
                    onChange={(e) => setReturnReason(e.target.value)}
                    placeholder="e.g. Expired, damaged, wrong product"
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
                    disabled={submitting}
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
