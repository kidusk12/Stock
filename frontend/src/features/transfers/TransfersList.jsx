import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../auth/AuthContext'
import { api } from '../../lib/api'
import { useFormatDate } from '../../lib/dateFormat'
import {
  Truck,
  Plus,
  ArrowRight,
  CheckCircle2,
  PackageCheck,
  Building2,
  Clock,
  Layers,
  AlertCircle
} from 'lucide-react'

export default function TransfersList() {
  const { user, selectedBranchId } = useAuth()
  const { t, i18n } = useTranslation()
  const isAm = i18n.language === 'am'
  const formatDate = useFormatDate()

  const [transfers, setTransfers] = useState([])
  const [branches, setBranches] = useState([])
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)

  // Modals
  const [showModal, setShowModal] = useState(false)
  const [fromBranchId, setFromBranchId] = useState('')
  const [toBranchId, setToBranchId] = useState('')
  const [transferItems, setTransferItems] = useState([{ productId: '', quantity: 1 }])
  const [errorMsg, setErrorMsg] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    loadTransfers()
    api.get('/branches').then((r) => setBranches(r.data || [])).catch(() => {})
    api.get('/products').then((r) => setProducts(r.data || [])).catch(() => {})
  }, [selectedBranchId])

  const loadTransfers = () => {
    setLoading(true)
    api.get('/transfers', { branchId: selectedBranchId })
      .then((res) => setTransfers(res.data || []))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false))
  }

  const addTransferItem = () => {
    setTransferItems([...transferItems, { productId: '', quantity: 1 }])
  }

  const removeTransferItem = (index) => {
    setTransferItems(transferItems.filter((_, i) => i !== index))
  }

  const handleCreateTransfer = async (e) => {
    e.preventDefault()
    setErrorMsg('')

    if (!fromBranchId || !toBranchId) {
      setErrorMsg(isAm ? 'እባክዎ ሁለቱንም ቅርንጫፎች ይምረጡ' : 'Please select both source and destination branches')
      return
    }
    if (fromBranchId === toBranchId) {
      setErrorMsg(isAm ? 'አስረካቢ እና ተቀባይ ቅርንጫፎች አንድ መሆን አይችሉም' : 'Source and destination branches must be different')
      return
    }

    const validItems = transferItems.filter((i) => i.productId && Number(i.quantity) > 0)
    if (validItems.length === 0) {
      setErrorMsg(isAm ? 'እባክዎ ቢያንስ አንድ ምርት ይምረጡ' : 'Please add at least one product')
      return
    }

    setSubmitting(true)
    try {
      await api.post('/transfers', {
        fromBranchId: Number(fromBranchId),
        toBranchId: Number(toBranchId),
        items: validItems.map((i) => ({ productId: Number(i.productId), quantity: Number(i.quantity) })),
      })
      setShowModal(false)
      setFromBranchId('')
      setToBranchId('')
      setTransferItems([{ productId: '', quantity: 1 }])
      loadTransfers()
    } catch (err) {
      setErrorMsg(err.message || 'Error creating transfer')
    } finally {
      setSubmitting(false)
    }
  }

  const handleApprove = async (id) => {
    try {
      await api.post(`/transfers/${id}/approve`)
      loadTransfers()
    } catch (err) {
      alert(err.message || 'Error approving transfer')
    }
  }

  const handleReject = async (id) => {
    const reason = window.prompt(isAm ? 'ምክንያቱን ያስገቡ' : 'Reason for rejection')
    if (reason === null) return
    try {
      await api.post(`/transfers/${id}/reject`, { reason })
      loadTransfers()
    } catch (err) {
      alert(err.message || 'Error rejecting transfer')
    }
  }

  const handleShip = async (id) => {
    try {
      await api.post(`/transfers/${id}/ship`)
      loadTransfers()
    } catch (err) {
      alert(err.message || 'Error shipping transfer')
    }
  }

  const handleReceive = async (id) => {
    try {
      await api.post(`/transfers/${id}/receive`)
      loadTransfers()
    } catch (err) {
      alert(err.message || 'Error receiving transfer')
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            {t('transfers.title')}
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            {isAm ? 'በቅርንጫፎች መካከል የሚደረግ የዕቃ ዝውውር እና የመንገድ ላይ ክትትል' : 'Inter-branch stock transfer workflow and in-transit inventory tracking'}
          </p>
        </div>

        {user?.role !== 'AUDITOR' && (
          <button
            onClick={() => { setShowModal(true); setErrorMsg(''); }}
            className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-blue-700 transition"
          >
            <Plus className="h-4 w-4" />
            {t('transfers.newTransfer')}
          </button>
        )}
      </div>

      {/* Transfers Table */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-soft overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase text-[11px] font-bold">
              <tr>
                <th className="py-3 px-4">{t('transfers.transferNo')}</th>
                <th className="py-3 px-4">{t('transfers.fromBranch')}</th>
                <th className="py-3 px-4">{t('transfers.toBranch')}</th>
                <th className="py-3 px-4">{t('sales.date')}</th>
                <th className="py-3 px-4 text-center">{t('sales.items')}</th>
                <th className="py-3 px-4 text-center">{t('transfers.status')}</th>
                {user?.role !== 'AUDITOR' && (
                  <th className="py-3 px-4 text-center">{t('common.actions')}</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
              {loading ? (
                <tr>
                  <td colSpan="7" className="py-8 text-center text-slate-400">
                    {t('common.loading')}
                  </td>
                </tr>
              ) : transfers.length === 0 ? (
                <tr>
                  <td colSpan="7" className="py-8 text-center text-slate-400">
                    {t('common.noData')}
                  </td>
                </tr>
              ) : (
                transfers.map((trf) => (
                  <tr key={trf.id} className="hover:bg-slate-50/70">
                    <td className="py-3 px-4 font-mono font-bold text-blue-700">TRF-{String(trf.id).padStart(6, '0')}</td>
                    <td className="py-3 px-4 font-semibold text-slate-800">{trf.fromBranchName}</td>
                    <td className="py-3 px-4 font-semibold text-slate-800">{trf.toBranchName}</td>
                    <td className="py-3 px-4 text-slate-500">{formatDate(trf.requestedAt)}</td>
                    <td className="py-3 px-4 text-center font-bold">{trf.items?.length || 0}</td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                          trf.status === 'SHIPPED'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : trf.status === 'RECEIVED'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : trf.status === 'APPROVED'
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {t(`status.${trf.status}`, trf.status)}
                      </span>
                    </td>

                    {user?.role !== 'AUDITOR' && (
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {trf.status === 'REQUESTED' && (user?.role === 'ADMIN' || user?.branchId === trf.fromBranchId) && (
                            <><button onClick={() => handleApprove(trf.id)} className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-blue-700">{t('transfers.approve')}</button>
                              <button onClick={() => handleReject(trf.id)} className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2.5 py-1 text-[11px] font-bold text-red-700">{t('transfers.reject', 'Reject')}</button></>
                          )}

                          {trf.status === 'APPROVED' && (user?.role === 'ADMIN' || user?.branchId === trf.fromBranchId) && (
                            <button
                              onClick={() => handleShip(trf.id)}
                              className="inline-flex items-center gap-1 rounded-lg bg-amber-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-amber-700"
                            >
                              <Truck className="h-3 w-3" />
                              {t('transfers.ship')}
                            </button>
                          )}

                          {trf.status === 'SHIPPED' && (user?.role === 'ADMIN' || user?.branchId === trf.toBranchId) && (
                            <button
                              onClick={() => handleReceive(trf.id)}
                              className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-emerald-700"
                            >
                              <CheckCircle2 className="h-3 w-3" />
                              {t('transfers.confirmReceipt')}
                            </button>
                          )}

                          {trf.status === 'RECEIVED' && (
                            <span className="text-slate-400 text-[11px] font-semibold flex items-center justify-center gap-1">
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                              {isAm ? 'ተጠናቋል' : 'Completed'}
                            </span>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* New Transfer Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl my-6">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-extrabold text-base text-slate-900">{t('transfers.newTransfer')}</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 font-bold">
                ✕
              </button>
            </div>

            {errorMsg && (
              <div className="mt-3 rounded-lg bg-red-50 p-2.5 text-xs font-semibold text-red-700 border border-red-200">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleCreateTransfer} className="mt-4 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">{t('transfers.fromBranch')} *</label>
                  <select
                    required
                    value={fromBranchId}
                    onChange={(e) => setFromBranchId(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-blue-500 focus:outline-none"
                  >
                    <option value="">{isAm ? 'አስረካቢ ቅርንጫፍ...' : 'Source Branch...'}</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">{t('transfers.toBranch')} *</label>
                  <select
                    required
                    value={toBranchId}
                    onChange={(e) => setToBranchId(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-blue-500 focus:outline-none"
                  >
                    <option value="">{isAm ? 'ተቀባይ ቅርንጫፍ...' : 'Destination Branch...'}</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Items */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-slate-800">{isAm ? 'የሚዘዋወሩ ምርቶች' : 'Items to Transfer'}</span>
                  <button
                    type="button"
                    onClick={addTransferItem}
                    className="text-[11px] font-bold text-blue-600 hover:underline flex items-center gap-1"
                  >
                    <Plus className="h-3 w-3" /> {isAm ? 'ዕቃ አክል' : 'Add Product'}
                  </button>
                </div>

                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {transferItems.map((item, idx) => (
                    <div key={idx} className="flex gap-2 items-center bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                      <select
                        required
                        value={item.productId}
                        onChange={(e) => {
                          const updated = [...transferItems]
                          updated[idx].productId = e.target.value
                          setTransferItems(updated)
                        }}
                        className="flex-1 rounded-lg border border-slate-300 px-2 py-1.5 text-xs bg-white"
                      >
                        <option value="">{isAm ? 'ምርት ይምረጡ...' : 'Select Product...'}</option>
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} ({p.sku})
                          </option>
                        ))}
                      </select>

                      <input
                        type="number"
                        min="1"
                        required
                        placeholder="Qty"
                        value={item.quantity}
                        onChange={(e) => {
                          const updated = [...transferItems]
                          updated[idx].quantity = e.target.value
                          setTransferItems(updated)
                        }}
                        className="w-20 rounded-lg border border-slate-300 px-2 py-1.5 text-xs text-center font-bold bg-white"
                      />

                      {transferItems.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeTransferItem(idx)}
                          className="text-slate-400 hover:text-red-600 p-1"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                </div>
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
                  {submitting ? t('common.loading') : isAm ? 'ጥያቄውን ላክ' : 'Send Transfer Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
