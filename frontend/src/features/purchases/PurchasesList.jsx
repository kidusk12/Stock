import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { api } from '../../lib/api'
import { formatETB, formatDate } from '../../lib/ethiopianDate'
import {
  PackageCheck,
  Plus,
  Check,
  X,
} from 'lucide-react'

export default function PurchasesList() {
  const { user, selectedBranchId } = useAuth()
  const { t, i18n } = useTranslation()

  const [orders, setOrders] = useState([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [pageCount, setPageCount] = useState(1)
  const [suppliers, setSuppliers] = useState([])
  const [branches, setBranches] = useState([])
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showReceiveModal, setShowReceiveModal] = useState(null)
  const [loadingReceiveId, setLoadingReceiveId] = useState(null)
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

  const loadReferenceList = useCallback(async (path, setter) => {
    try {
      const firstPage = await api.get(path, { page: 1, limit: 100 })
      const count = Math.ceil((firstPage.total || 0) / (firstPage.limit || 100))
      const otherPages = await Promise.all(Array.from({ length: Math.max(0, count - 1) }, (_, index) =>
        api.get(path, { page: index + 2, limit: 100 })
      ))
      setter([...(firstPage.data || []), ...otherPages.flatMap((result) => result.data || [])])
    } catch {
      setter([])
    }
  }, [])

  const loadOrders = useCallback(() => {
    setLoading(true)
    setLoadError('')
    api.get('/purchase-orders', { branchId: selectedBranchId || undefined, page, limit: 20 })
      .then((res) => {
        setOrders(Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [])
        setTotal(res.total ?? res.data?.length ?? 0)
        setPageCount(Math.max(1, Math.ceil((res.total ?? 0) / (res.limit || 20))))
      })
      .catch((err) => setLoadError(t(`errors.${err.code}`, { defaultValue: t('purchases.loadError') })))
      .finally(() => setLoading(false))
  }, [page, selectedBranchId, t])

  useEffect(() => {
    // Start the API request; its state updates happen after the request settles.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadOrders()
  }, [loadOrders])

  useEffect(() => {
    void loadReferenceList('/suppliers', setSuppliers)
    void loadReferenceList('/branches', setBranches)
    void loadReferenceList('/products', setProducts)
  }, [loadReferenceList])

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
      setErrorMsg(t('purchases.selectSupplier'))
      return
    }

    const validItems = lineItems.filter((i) => i.productId && Number(i.quantity) > 0 && Number(i.unitCost) >= 0)
    if (validItems.length === 0) {
      setErrorMsg(t('purchases.addValidItem'))
      return
    }
    if (validItems.some((item) => !/^\d+(\.\d{1,2})?$/.test(String(item.quantity)) || !/^\d+(\.\d{1,2})?$/.test(String(item.unitCost)))) {
      setErrorMsg(t('purchases.invalidNumbers'))
      return
    }
    if (new Set(validItems.map((item) => String(item.productId))).size !== validItems.length) {
      setErrorMsg(t('purchases.duplicateProduct'))
      return
    }
    if (user?.role === 'ADMIN' && !destBranchId) {
      setErrorMsg(t('purchases.branchRequired'))
      return
    }

    setSubmitting(true)
    try {
      await api.post('/purchase-orders', {
        supplierId: Number(supplierId),
        ...(user?.role === 'ADMIN' ? { branchId: Number(destBranchId) } : {}),
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
      setErrorMsg(t(`errors.${err.code}`, { defaultValue: t('purchases.saveError') }))
    } finally {
      setSubmitting(false)
    }
  }

  // Handle Approval
  const handleApprove = async (poId) => {
    try {
      await api.post(`/purchase-orders/${poId}/approve`)
      loadOrders()
    } catch (err) {
      setLoadError(t(`errors.${err.code}`, { defaultValue: t('purchases.actionError') }))
    }
  }

  // Handle Reject
  const handleReject = async () => {
    if (!showRejectModal) return
    try {
      await api.post(`/purchase-orders/${showRejectModal.id}/reject`, { reason: rejectReason })
      setShowRejectModal(null)
      setRejectReason('')
      loadOrders()
    } catch (err) {
      setErrorMsg(t(`errors.${err.code}`, { defaultValue: t('purchases.actionError') }))
    }
  }

  // Open Receiving Modal
  const openReceiving = async (po) => {
    setErrorMsg('')
    setLoadingReceiveId(po.id)
    try {
      // The list endpoint returns summaries without line items; load the detail for receiving quantities.
      const detailedOrder = await api.get(`/purchase-orders/${po.id}`)
      setShowReceiveModal(detailedOrder)
      const init = {}
      detailedOrder.items?.forEach((item) => {
        init[item.id] = Math.max(0, item.quantity - item.receivedQuantity)
      })
      setReceivingQuantities(init)
    } catch (err) {
      setLoadError(t(`errors.${err.code}`, { defaultValue: t('purchases.detailLoadError') }))
    } finally {
      setLoadingReceiveId(null)
    }
  }

  const handleReceiveGoods = async (e) => {
    e.preventDefault()
    if (!showReceiveModal) return
    setErrorMsg('')
    setSubmitting(true)

    try {
      const itemsPayload = Object.entries(receivingQuantities)
        .map(([itemId, qty]) => ({ itemId: Number(itemId), quantity: Number(qty) }))
        .filter((i) => i.quantity > 0)

      if (itemsPayload.length === 0) {
      setErrorMsg(t('purchases.enterReceiveQty'))
        setSubmitting(false)
        return
      }

      await api.post(`/purchase-orders/${showReceiveModal.id}/receive`, {
        items: itemsPayload,
      })
      setShowReceiveModal(null)
      loadOrders()
    } catch (err) {
      if (err.code === 'OVER_RECEIVE' && Array.isArray(err.details)) {
        setErrorMsg(err.details.map((detail) => {
          const item = showReceiveModal.items?.find((line) => line.id === detail.itemId)
          return t('purchases.overReceiveDetail', {
            product: item?.productName || t('purchases.product'),
            remaining: detail.remaining,
            requested: detail.requested,
          })
        }).join(' '))
      } else {
        setErrorMsg(t(`errors.${err.code}`, { defaultValue: t('purchases.actionError') }))
      }
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
          <p className="text-xs text-slate-500 mt-1">{t('purchases.description')}</p>
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

      {loadError && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{loadError}<button type="button" onClick={loadOrders} className="ml-2 font-bold underline">{t('common.retry')}</button></div>}

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
                  <td colSpan={user?.role === 'AUDITOR' ? 6 : 7} className="py-8 text-center text-slate-400">
                    {t('common.loading')}
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={user?.role === 'AUDITOR' ? 6 : 7} className="py-8 text-center text-slate-400">
                    {t('common.noData')}
                  </td>
                </tr>
              ) : (
                orders.map((po) => (
                  <tr key={po.id} className="hover:bg-slate-50/70">
                    <td className="py-3 px-4 font-mono font-bold"><Link to={`/purchases/${po.id}`} className="text-teal-800 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700">{po.poNumber}</Link></td>
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
                              disabled={loadingReceiveId === po.id}
                              className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-blue-700 shadow-2xs disabled:opacity-60"
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

      {!loading && pageCount > 1 && <div className="flex items-center justify-between text-sm text-slate-600">
        <span>{t('purchases.pageSummary', { page, pageCount, total })}</span>
        <div className="flex gap-2"><button type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)} className="rounded-lg border border-slate-300 px-3 py-1.5 font-semibold disabled:opacity-40">{t('common.previous')}</button>
          <button type="button" disabled={page >= pageCount} onClick={() => setPage((value) => value + 1)} className="rounded-lg border border-slate-300 px-3 py-1.5 font-semibold disabled:opacity-40">{t('common.next')}</button></div>
      </div>}

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
                    <option value="">{t('purchases.selectSupplierOption')}</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">{t('purchases.branch')}</label>
                  <select
                    required={user?.role === 'ADMIN'}
                    disabled={user?.role !== 'ADMIN'}
                    value={user?.role === 'ADMIN' ? destBranchId : String(user?.branchId ?? '')}
                    onChange={(e) => setDestBranchId(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-blue-500 focus:outline-none"
                  >
                    {user?.role === 'ADMIN' && <option value="">{t('purchases.selectBranch')}</option>}
                    {branches.filter((branch) => user?.role === 'ADMIN' || branch.id === user?.branchId).map((b) => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Line Items */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-slate-800">{t('purchases.lineItemsTitle')}</span>
                  <button
                    type="button"
                    onClick={addLineItem}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:underline"
                  >
                    <Plus className="h-3 w-3" /> {t('purchases.addProduct')}
                  </button>
                </div>

                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {lineItems.map((item, idx) => (
                    <div key={idx} className="grid min-w-0 grid-cols-[minmax(0,1fr)_4rem_6rem_auto] items-center gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                      <select
                        required
                        value={item.productId}
                        onChange={(e) => handleProductChange(idx, e.target.value)}
                        className="w-full min-w-0 rounded-lg border border-slate-300 px-2 py-1.5 text-xs bg-white"
                      >
                        <option value="">{t('purchases.selectProductOption')}</option>
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} ({p.sku})
                          </option>
                        ))}
                      </select>

                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        required
                        placeholder={t('purchases.quantityShort')}
                        value={item.quantity}
                        onChange={(e) => {
                          const updated = [...lineItems]
                          updated[idx].quantity = e.target.value
                          setLineItems(updated)
                        }}
                        className="w-full min-w-0 rounded-lg border border-slate-300 px-2 py-1.5 text-xs text-center font-bold bg-white"
                      />

                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        required
                        placeholder={t('purchases.unitCost')}
                        value={item.unitCost}
                        onChange={(e) => {
                          const updated = [...lineItems]
                          updated[idx].unitCost = e.target.value
                          setLineItems(updated)
                        }}
                        className="w-full min-w-0 rounded-lg border border-slate-300 px-2 py-1.5 text-xs text-right font-bold bg-white"
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
                {t('purchases.receivingHelp')}
              </p>

              <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-x-hidden overflow-y-auto max-h-60">
                {showReceiveModal.items?.map((it) => {
                  const remaining = Math.max(0, it.quantity - it.receivedQuantity)
                  return (
                    <div key={it.id} className="p-3 bg-white flex flex-wrap items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="break-words font-bold text-slate-800">{it.productName}</div>
                        <div className="text-[10px] text-slate-500 font-mono">
                          {t('purchases.orderedAndReceived', { ordered: it.quantity, received: it.receivedQuantity, remaining })}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className="text-slate-500 text-[11px] font-semibold">{t('purchases.receivingLabel')}:</span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={receivingQuantities[it.id] ?? 0}
                          onChange={(e) =>
                            setReceivingQuantities({
                              ...receivingQuantities,
                              [it.id]: Math.max(0, Number(e.target.value)),
                            })
                          }
                        className="w-16 shrink-0 rounded-lg border border-slate-300 px-2 py-1 text-center font-bold text-xs focus:border-blue-500 focus:outline-none"
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
                  {submitting ? t('common.loading') : t('purchases.confirmReceipt')}
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
              {t('purchases.rejectPrompt')}
            </p>

            <textarea
              maxLength={300}
              rows="3"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder={t('purchases.rejectReasonPlaceholder')}
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
