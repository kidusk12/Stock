import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../auth/AuthContext'
import { api } from '../../lib/api'
import { formatETB, formatDate } from '../../lib/ethiopianDate'
import {
  PackageCheck,
  Plus,
  Check,
  X,
  Package,
  AlertCircle,
  Truck,
  Building2,
  Calendar,
  Layers
} from 'lucide-react'

export default function PurchasesList() {
  const { user, selectedBranchId } = useAuth()
  const { t, i18n } = useTranslation()
  const isAm = i18n.language === 'am'

  const [orders, setOrders] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [branches, setBranches] = useState([])
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showReceiveModal, setShowReceiveModal] = useState(null)
  const [showRejectModal, setShowRejectModal] = useState(null)
  const [rejectReason, setRejectReason] = useState('')

  // Create PO form
  const [supplierId, setSupplierId] = useState('')
  const [destBranchId, setDestBranchId] = useState('')
  const [lineItems, setLineItems] = useState([{ productId: '', quantity: 1, unitCost: 0 }])
  const [errorMsg, setErrorMsg] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Receiving state
  const [receivingQuantities, setReceivingQuantities] = useState({}) // lineItemId -> qty

  useEffect(() => {
    loadOrders()
    api.get('/suppliers').then((r) => setSuppliers(r.data || [])).catch(() => {})
    api.get('/branches').then((r) => setBranches(r.data || [])).catch(() => {})
    api.get('/products').then((r) => setProducts(r.data || [])).catch(() => {})
  }, [selectedBranchId])

  const loadOrders = () => {
    setLoading(true)
    api.get('/purchase-orders', { branchId: selectedBranchId })
      .then((res) => setOrders(res.data || []))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false))
  }

  // Handle PO Creation
  const addLineItem = () => {
    setLineItems([...lineItems, { productId: '', quantity: 1, unitCost: 0 }])
  }

  const removeLineItem = (index) => {
    setLineItems(lineItems.filter((_, i) => i !== index))
  }

  const handleProductChange = (index, prodId) => {
    const prod = products.find((p) => p.id === Number(prodId))
    const updated = [...lineItems]
    updated[index].productId = prodId
    updated[index].unitCost = prod?.costPrice || 0
    setLineItems(updated)
  }

  const handleCreatePo = async (e) => {
    e.preventDefault()
    setErrorMsg('')
    if (!supplierId) {
      setErrorMsg(isAm ? 'እባክዎ አቅራቢ ይምረጡ' : 'Please select a supplier')
      return
    }

    const validItems = lineItems.filter((i) => i.productId && Number(i.quantity) > 0)
    if (validItems.length === 0) {
      setErrorMsg(isAm ? 'እባክዎ ቢያንስ አንድ ምርት ይምረጡ' : 'Please add at least one valid product')
      return
    }

    setSubmitting(true)
    try {
      await api.post('/purchase-orders', {
        supplierId: Number(supplierId),
        branchId: Number(destBranchId) || user?.branchId || 1,
        items: validItems.map((i) => ({
          productId: Number(i.productId),
          quantity: Number(i.quantity),
          unitCost: Number(i.unitCost),
        })),
      })
      setShowCreateModal(false)
      setSupplierId('')
      setLineItems([{ productId: '', quantity: 1, unitCost: 0 }])
      loadOrders()
    } catch (err) {
      setErrorMsg(err.message || 'Failed to create PO')
    } finally {
      setSubmitting(false)
    }
  }

  // Handle Approval
  const handleApprove = async (poId) => {
    try {
      await api.patch(`/purchase-orders/${poId}/approve`)
      loadOrders()
    } catch (err) {
      alert(err.message || 'Error approving order')
    }
  }

  // Handle Reject
  const handleReject = async () => {
    if (!showRejectModal) return
    try {
      await api.patch(`/purchase-orders/${showRejectModal.id}/reject`, { reason: rejectReason })
      setShowRejectModal(null)
      setRejectReason('')
      loadOrders()
    } catch (err) {
      alert(err.message || 'Error rejecting order')
    }
  }

  // Open Receiving Modal
  const openReceiving = (po) => {
    setShowReceiveModal(po)
    const init = {}
    po.items?.forEach((it) => {
      init[it.id] = Math.max(0, it.quantity - it.receivedQuantity)
    })
    setReceivingQuantities(init)
  }

  const handleReceiveGoods = async (e) => {
    e.preventDefault()
    if (!showReceiveModal) return
    setErrorMsg('')
    setSubmitting(true)

    try {
      const itemsPayload = Object.entries(receivingQuantities)
        .map(([id, qty]) => ({ id: Number(id), quantity: Number(qty) }))
        .filter((i) => i.quantity > 0)

      if (itemsPayload.length === 0) {
        setErrorMsg(isAm ? 'እባክዎ የሚቀበሉትን ብዛት ያስገቡ' : 'Please enter quantity to receive')
        setSubmitting(false)
        return
      }

      await api.post(`/purchase-orders/${showReceiveModal.id}/receive`, {
        items: itemsPayload,
      })
      setShowReceiveModal(null)
      loadOrders()
    } catch (err) {
      setErrorMsg(err.message || t(`errors.${err.code}`, 'Error receiving goods'))
    } finally {
      setSubmitting(false)
    }
  }

  const canApprove = user?.role === 'ADMIN' || user?.role === 'BRANCH_MANAGER'
  const canReceive = user?.role === 'ADMIN' || user?.role === 'BRANCH_MANAGER' || user?.role === 'STAFF'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            {t('purchases.title')}
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            {isAm ? 'የግዢ ትዕዛዞች፣ የሥራ አስኪያጅ ማጽደቂያ እና የዕቃ መቀበያ' : 'Purchase orders, manager approval, and partial goods receiving'}
          </p>
        </div>

        {user?.role !== 'AUDITOR' && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-blue-700 transition"
          >
            <Plus className="h-4 w-4" />
            {t('purchases.newPo')}
          </button>
        )}
      </div>

      {/* Orders Table */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-soft overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase text-[11px] font-bold">
              <tr>
                <th className="py-3 px-4">{t('purchases.poNumber')}</th>
                <th className="py-3 px-4">{t('purchases.supplier')}</th>
                <th className="py-3 px-4">{t('purchases.branch')}</th>
                <th className="py-3 px-4">{t('purchases.orderDate')}</th>
                <th className="py-3 px-4 text-right">{t('purchases.totalCost')}</th>
                <th className="py-3 px-4 text-center">{t('purchases.status')}</th>
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
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan="7" className="py-8 text-center text-slate-400">
                    {t('common.noData')}
                  </td>
                </tr>
              ) : (
                orders.map((po) => (
                  <tr key={po.id} className="hover:bg-slate-50/70">
                    <td className="py-3 px-4 font-mono font-bold text-blue-700">{po.poNumber}</td>
                    <td className="py-3 px-4 font-bold text-slate-900">{po.supplierName}</td>
                    <td className="py-3 px-4">{po.branchName}</td>
                    <td className="py-3 px-4 text-slate-500">{formatDate(po.createdAt, i18n.language)}</td>
                    <td className="py-3 px-4 text-right font-extrabold text-slate-900">
                      {formatETB(po.totalCost, i18n.language)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                          po.status === 'APPROVED'
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : po.status === 'RECEIVED'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : po.status === 'PARTIALLY_RECEIVED'
                            ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                            : po.status === 'REJECTED'
                            ? 'bg-red-50 text-red-700 border border-red-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}
                      >
                        {t(`status.${po.status}`, po.status)}
                      </span>
                    </td>

                    {user?.role !== 'AUDITOR' && (
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {po.status === 'PENDING_APPROVAL' && canApprove && (
                            <>
                              <button
                                onClick={() => handleApprove(po.id)}
                                className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-emerald-700"
                              >
                                <Check className="h-3 w-3" />
                                {t('purchases.approve')}
                              </button>
                              <button
                                onClick={() => { setShowRejectModal(po); setRejectReason(''); }}
                                className="inline-flex items-center gap-1 rounded-lg bg-red-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-red-700"
                              >
                                <X className="h-3 w-3" />
                                {t('purchases.reject')}
                              </button>
                            </>
                          )}

                          {(po.status === 'APPROVED' || po.status === 'PARTIALLY_RECEIVED') && canReceive && (
                            <button
                              onClick={() => openReceiving(po)}
                              className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-blue-700 shadow-2xs"
                            >
                              <PackageCheck className="h-3.5 w-3.5" />
                              {t('purchases.receive')}
                            </button>
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

      {/* Create PO Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl my-6">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-extrabold text-base text-slate-900">{t('purchases.newPo')}</h3>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-slate-600 font-bold">
                ✕
              </button>
            </div>

            {errorMsg && (
              <div className="mt-3 rounded-lg bg-red-50 p-2.5 text-xs font-semibold text-red-700 border border-red-200">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleCreatePo} className="mt-4 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">{t('purchases.supplier')} *</label>
                  <select
                    required
                    value={supplierId}
                    onChange={(e) => setSupplierId(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-blue-500 focus:outline-none"
                  >
                    <option value="">{isAm ? 'አቅራቢ ይምረጡ...' : 'Select Supplier...'}</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">{t('purchases.branch')}</label>
                  <select
                    value={destBranchId}
                    onChange={(e) => setDestBranchId(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-blue-500 focus:outline-none"
                  >
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Line Items */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-slate-800">{isAm ? 'የሚታዘዙ ዕቃዎች' : 'Order Line Items'}</span>
                  <button
                    type="button"
                    onClick={addLineItem}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:underline"
                  >
                    <Plus className="h-3 w-3" /> {isAm ? 'ዕቃ አክል' : 'Add Product'}
                  </button>
                </div>

                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {lineItems.map((item, idx) => (
                    <div key={idx} className="flex gap-2 items-center bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                      <select
                        required
                        value={item.productId}
                        onChange={(e) => handleProductChange(idx, e.target.value)}
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
                          const updated = [...lineItems]
                          updated[idx].quantity = e.target.value
                          setLineItems(updated)
                        }}
                        className="w-16 rounded-lg border border-slate-300 px-2 py-1.5 text-xs text-center font-bold bg-white"
                      />

                      <input
                        type="number"
                        step="0.01"
                        required
                        placeholder="Unit Cost"
                        value={item.unitCost}
                        onChange={(e) => {
                          const updated = [...lineItems]
                          updated[idx].unitCost = e.target.value
                          setLineItems(updated)
                        }}
                        className="w-24 rounded-lg border border-slate-300 px-2 py-1.5 text-xs text-right font-bold bg-white"
                      />

                      {lineItems.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeLineItem(idx)}
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
                  onClick={() => setShowCreateModal(false)}
                  className="rounded-xl border border-slate-300 px-4 py-2 font-bold text-slate-600 hover:bg-slate-50"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-xl bg-blue-600 px-5 py-2 font-bold text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {submitting ? t('common.loading') : t('common.save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Partial Receiving Modal (Feature 15) */}
      {showReceiveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="font-extrabold text-base text-slate-900">{t('purchases.receive')}</h3>
                <p className="text-xs text-blue-600 font-mono mt-0.5">{showReceiveModal.poNumber} · {showReceiveModal.supplierName}</p>
              </div>
              <button onClick={() => setShowReceiveModal(null)} className="text-slate-400 hover:text-slate-600 font-bold">
                ✕
              </button>
            </div>

            {errorMsg && (
              <div className="mt-3 rounded-lg bg-red-50 p-2.5 text-xs font-semibold text-red-700 border border-red-200">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleReceiveGoods} className="mt-4 space-y-4 text-xs">
              <p className="text-slate-600">
                {isAm
                  ? 'የተረከቧቸውን ዕቃዎች ብዛት ያስገቡ። በከፊል ከተረከቡ ቀሪው ለሌላ ጊዜ ይቆያል።'
                  : 'Enter received quantities for each item. Partial receiving will update inventory immediately.'}
              </p>

              <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden max-h-60 overflow-y-auto">
                {showReceiveModal.items?.map((it) => {
                  const remaining = Math.max(0, it.quantity - it.receivedQuantity)
                  return (
                    <div key={it.id} className="p-3 bg-white flex items-center justify-between">
                      <div>
                        <div className="font-bold text-slate-800">{it.productName}</div>
                        <div className="text-[10px] text-slate-500 font-mono">
                          Ordered: {it.quantity} | Already Received: {it.receivedQuantity}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-slate-500 text-[11px] font-semibold">Receiving:</span>
                        <input
                          type="number"
                          min="0"
                          max={remaining}
                          value={receivingQuantities[it.id] ?? 0}
                          onChange={(e) =>
                            setReceivingQuantities({
                              ...receivingQuantities,
                              [it.id]: Math.min(remaining, Math.max(0, Number(e.target.value))),
                            })
                          }
                          className="w-16 rounded-lg border border-slate-300 px-2 py-1 text-center font-bold text-xs focus:border-blue-500 focus:outline-none"
                        />
                      </div>
                    </div>
                  )
                })}
              </div>

              <div className="mt-6 flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowReceiveModal(null)}
                  className="rounded-xl border border-slate-300 px-4 py-2 font-bold text-slate-600 hover:bg-slate-50"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-xl bg-blue-600 px-5 py-2 font-bold text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {submitting ? t('common.loading') : isAm ? 'ዕቃዎችን ተረከብ' : 'Confirm Receipt'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reject Reason Dialog (Contract 6.5 & M4) */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="font-extrabold text-base text-red-700">{t('purchases.reject')} {showRejectModal.poNumber}</h3>
            <p className="text-xs text-slate-500 mt-1">
              {isAm ? 'እባክዎ ይህን የግዢ ትዕዛዝ ውድቅ ያደረጉበትን ምክንያት ያስገቡ:' : 'Please provide the reason for rejecting this purchase order:'}
            </p>

            <textarea
              required
              rows="3"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="e.g. Budget exceeded, duplicate order"
              className="mt-3 w-full rounded-xl border border-slate-300 p-2.5 text-xs focus:border-red-500 focus:outline-none"
            />

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowRejectModal(null)}
                className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-bold text-slate-600"
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                onClick={handleReject}
                className="rounded-xl bg-red-600 px-4 py-2 text-xs font-bold text-white hover:bg-red-700"
              >
                {t('purchases.reject')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
