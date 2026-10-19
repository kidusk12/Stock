import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../auth/AuthContext'
import { api } from '../../lib/api'
import { useFormatDate } from '../../lib/dateFormat'
import {
  SlidersHorizontal,
  Plus,
  AlertTriangle,
  FileText,
  User,
  Building2,
  Calendar
} from 'lucide-react'

export default function AdjustmentsList() {
  const { user, selectedBranchId } = useAuth()
  const { t, i18n } = useTranslation()
  const isAm = i18n.language === 'am'
  const formatDate = useFormatDate()

  const [adjustments, setAdjustments] = useState([])
  const [products, setProducts] = useState([])
  const [branches, setBranches] = useState([])
  const [loading, setLoading] = useState(true)

  // Modal
  const [showModal, setShowModal] = useState(false)
  const [branchId, setBranchId] = useState('')
  const [productId, setProductId] = useState('')
  const [quantityChange, setQuantityChange] = useState('')
  const [reason, setReason] = useState('DAMAGE')
  const [notes, setNotes] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    loadAdjustments()
    api.get('/products').then((r) => setProducts(r.data || [])).catch(() => {})
    api.get('/branches').then((r) => setBranches(r.data || [])).catch(() => {})
  }, [selectedBranchId])

  const loadAdjustments = () => {
    setLoading(true)
    api.get('/adjustments', { branchId: selectedBranchId })
      .then((res) => setAdjustments(res.data || []))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false))
  }

  const handleCreateAdjustment = async (e) => {
    e.preventDefault()
    setErrorMsg('')

    if (!productId) {
      setErrorMsg(isAm ? 'እባክዎ ምርት ይምረጡ' : 'Please select a product')
      return
    }
    if (!notes.trim()) {
      setErrorMsg(isAm ? 'እባክዎ የማስተካከያ ማብራሪያ ያስገቡ' : 'Please provide notes/explanation')
      return
    }

    setSubmitting(true)
    try {
      await api.post('/adjustments', {
        branchId: Number(branchId) || user?.branchId || undefined,
        productId: Number(productId),
        quantity: Number(quantityChange),
        reason,
        note: notes.trim(),
      })
      setShowModal(false)
      setProductId('')
      setQuantityChange('')
      setNotes('')
      loadAdjustments()
    } catch (err) {
      setErrorMsg(err.message || t(`errors.${err.code}`, 'Error creating adjustment'))
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
          <p className="text-xs text-slate-500 mt-1">
            {isAm ? 'በብልሽት፣ በቆጠራ ልዩነት ወይም በኪሳራ ምክንያት የሚደረጉ የክምችት ማስተካከያዎች' : 'Physical inventory adjustments for damage, expiry, recount, or loss with audit reason'}
          </p>
        </div>

        {user?.role !== 'AUDITOR' && (
          <button
            onClick={() => { setShowModal(true); setErrorMsg(''); }}
            className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-blue-700 transition"
          >
            <Plus className="h-4 w-4" />
            {t('adjustments.newAdjustment')}
          </button>
        )}
      </div>

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
                <th className="py-3 px-4">{isAm ? 'የመዘገበው ተጠቃሚ' : 'Logged By'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
              {loading ? (
                <tr>
                  <td colSpan="7" className="py-8 text-center text-slate-400">
                    {t('common.loading')}
                  </td>
                </tr>
              ) : adjustments.length === 0 ? (
                <tr>
                  <td colSpan="7" className="py-8 text-center text-slate-400">
                    {t('common.noData')}
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
                          a.quantity > 0
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-red-50 text-red-700'
                        }`}
                      >
                        {a.quantity > 0 ? `+${a.quantity}` : a.quantity}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-800">
                      {t(`reasons.${a.reason}`, a.reason)}
                    </td>
                    <td className="py-3 px-4 text-slate-500 max-w-xs truncate">{a.note}</td>
                    <td className="py-3 px-4 text-slate-600">{a.createdByName || 'Staff'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* New Adjustment Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-extrabold text-base text-slate-900">{t('adjustments.newAdjustment')}</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 font-bold">
                ✕
              </button>
            </div>

            {errorMsg && (
              <div className="mt-3 rounded-lg bg-red-50 p-2.5 text-xs font-semibold text-red-700 border border-red-200">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleCreateAdjustment} className="mt-4 space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">{t('adjustments.branch')}</label>
                <select
                  value={branchId}
                  onChange={(e) => setBranchId(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-blue-500 focus:outline-none"
                >
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">{t('adjustments.product')} *</label>
                <select
                  required
                  value={productId}
                  onChange={(e) => setProductId(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-blue-500 focus:outline-none"
                >
                  <option value="">{isAm ? 'ምርት ይምረጡ...' : 'Select Product...'}</option>
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
                    step="1"
                    value={quantityChange}
                    onChange={(e) => setQuantityChange(e.target.value)}
                    placeholder="e.g. -5 or 10"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-blue-500 focus:outline-none font-bold text-center"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">{t('adjustments.notes')} *</label>
                <textarea
                  required
                  rows="3"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Broken jars during unloading"
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
