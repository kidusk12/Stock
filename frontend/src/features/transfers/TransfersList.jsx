import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../auth/AuthContext'
import { Link } from 'react-router-dom'
import { api } from '../../lib/api'
import { formatDate } from '../../lib/ethiopianDate'
import { Truck, Plus, CheckCircle2 } from 'lucide-react'

export default function TransfersList() {
  const { user, selectedBranchId } = useAuth()
  const { t, i18n } = useTranslation()
  const [transfers, setTransfers] = useState([])
  const [branches, setBranches] = useState([])
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [actionError, setActionError] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [actionLoading, setActionLoading] = useState(null)
  const [filters, setFilters] = useState({ status: '', direction: '', from: '', to: '' })
  const [appliedFilters, setAppliedFilters] = useState({ status: '', direction: '', from: '', to: '' })

  // Modals
  const [showModal, setShowModal] = useState(false)
  const [fromBranchId, setFromBranchId] = useState('')
  const [toBranchId, setToBranchId] = useState('')
  const [transferItems, setTransferItems] = useState([{ productId: '', quantity: 1 }])
  const [note, setNote] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [rejectTransfer, setRejectTransfer] = useState(null)
  const [rejectReason, setRejectReason] = useState('')

  useEffect(() => {
    loadTransfers()
    api.get('/branches', { limit: 100 }).then((r) => setBranches(Array.isArray(r?.data) ? r.data : [])).catch(() => setBranches([]))
    api.get('/products', { limit: 100 }).then((r) => setProducts(Array.isArray(r?.data) ? r.data : [])).catch(() => setProducts([]))
  }, [selectedBranchId, user?.role])

  const loadTransfers = (nextPage = 1, activeFilters = appliedFilters) => {
    setLoading(true)
    setLoadError('')
    api.get('/transfers', {
      branchId: user?.role === 'ADMIN' ? selectedBranchId : undefined,
      status: activeFilters.status || undefined,
      direction: user?.role === 'ADMIN' ? undefined : activeFilters.direction || undefined,
      from: activeFilters.from || undefined,
      to: activeFilters.to || undefined,
      page: nextPage,
      limit: 20,
    })
      .then((res) => {
        setTransfers(Array.isArray(res?.data) ? res.data : [])
        setPage(res?.page || nextPage)
        setTotal(Number(res?.total) || 0)
      })
      .catch((err) => setLoadError(t(`errors.${err.code}`, { defaultValue: t('transfers.loadError') })))
      .finally(() => setLoading(false))
  }

  const handleFilterSubmit = (event) => {
    event.preventDefault()
    setAppliedFilters(filters)
    loadTransfers(1, filters)
  }

  const clearFilters = () => {
    const emptyFilters = { status: '', direction: '', from: '', to: '' }
    setFilters(emptyFilters)
    setAppliedFilters(emptyFilters)
    loadTransfers(1, emptyFilters)
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

    const destinationId = user?.role === 'ADMIN' ? toBranchId : String(user?.branchId || '')
    if (!fromBranchId || !destinationId) {
      setErrorMsg(t('transfers.selectBothBranches'))
      return
    }
    if (fromBranchId === destinationId) {
      setErrorMsg(t('transfers.differentBranches'))
      return
    }

    const validItems = transferItems.filter((item) => item.productId && Number(item.quantity) > 0)
    if (validItems.length === 0 || validItems.length !== transferItems.length) {
      setErrorMsg(t('transfers.addValidItem'))
      return
    }
    if (validItems.some((item) => !/^\d+(\.\d{1,2})?$/.test(String(item.quantity)) || Number(item.quantity) <= 0)) {
      setErrorMsg(t('transfers.invalidQuantity'))
      return
    }
    if (new Set(validItems.map((item) => Number(item.productId))).size !== validItems.length) {
      setErrorMsg(t('transfers.duplicateProduct'))
      return
    }

    setSubmitting(true)
    try {
      await api.post('/transfers', {
        fromBranchId: Number(fromBranchId),
        toBranchId: Number(destinationId),
        ...(note.trim() ? { note: note.trim() } : {}),
        items: validItems.map((i) => ({ productId: Number(i.productId), quantity: Number(i.quantity) })),
      })
      setShowModal(false)
      setFromBranchId('')
      setToBranchId('')
      setTransferItems([{ productId: '', quantity: 1 }])
      setNote('')
      const emptyFilters = { status: '', direction: '', from: '', to: '' }
      setFilters(emptyFilters)
      setAppliedFilters(emptyFilters)
      loadTransfers(1, emptyFilters)
    } catch (err) {
      setErrorMsg(t(`errors.${err.code}`, { defaultValue: t('transfers.createError') }))
    } finally {
      setSubmitting(false)
    }
  }

  const withAction = async (id, action, request) => {
    setActionError('')
    setActionLoading(`${id}:${action}`)
    try {
      await request()
      loadTransfers()
    } catch (err) {
      setActionError(t(`errors.${err.code}`, { defaultValue: t(`transfers.${action}Error`) }))
    } finally {
      setActionLoading(null)
    }
  }

  const handleApprove = (id) => withAction(id, 'approve', () => api.post(`/transfers/${id}/approve`))

  const handleShip = (id) => withAction(id, 'ship', () => api.post(`/transfers/${id}/ship`))

  const handleReceive = (id) => withAction(id, 'receive', () => api.post(`/transfers/${id}/receive`))

  const handleReject = async (event) => {
    event.preventDefault()
    if (!rejectTransfer) return
    setActionError('')
    setActionLoading(`${rejectTransfer.id}:reject`)
    try {
      await api.post(`/transfers/${rejectTransfer.id}/reject`, { reason: rejectReason.trim() || undefined })
      setRejectTransfer(null)
      setRejectReason('')
      loadTransfers()
    } catch (err) {
      setActionError(t(`errors.${err.code}`, { defaultValue: t('transfers.rejectError') }))
    } finally {
      setActionLoading(null)
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
          <p className="text-xs text-slate-500 mt-1">{t('transfers.description')}</p>
        </div>

        {user?.role !== 'AUDITOR' && (
          <button
            onClick={() => { setShowModal(true); setErrorMsg(''); setFromBranchId(''); setToBranchId(user?.role === 'ADMIN' ? '' : String(user?.branchId || '')); setNote(''); setTransferItems([{ productId: '', quantity: 1 }]); }}
            className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-blue-700 transition"
          >
            <Plus className="h-4 w-4" />
            {t('transfers.newTransfer')}
          </button>
        )}
      </div>

      <form onSubmit={handleFilterSubmit} className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-5">
        <label className="text-xs font-bold text-slate-700">{t('transfers.status')}<select value={filters.status} onChange={(event) => setFilters((previous) => ({ ...previous, status: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"><option value="">{t('transfers.allStatuses')}</option>{['REQUESTED', 'APPROVED', 'REJECTED', 'SHIPPED', 'RECEIVED'].map((status) => <option key={status} value={status}>{t(`status.${status}`, status)}</option>)}</select></label>
        {user?.role !== 'ADMIN' && <label className="text-xs font-bold text-slate-700">{t('transfers.direction')}<select value={filters.direction} onChange={(event) => setFilters((previous) => ({ ...previous, direction: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"><option value="">{t('transfers.allDirections')}</option><option value="incoming">{t('transfers.incoming')}</option><option value="outgoing">{t('transfers.outgoing')}</option></select></label>}
        <label className="text-xs font-bold text-slate-700">{t('sales.from')}<input type="date" value={filters.from} max={filters.to || undefined} onChange={(event) => setFilters((previous) => ({ ...previous, from: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" /></label>
        <label className="text-xs font-bold text-slate-700">{t('sales.to')}<input type="date" value={filters.to} min={filters.from || undefined} onChange={(event) => setFilters((previous) => ({ ...previous, to: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" /></label>
        <div className="flex gap-2 self-end"><button type="submit" className="flex-1 rounded-lg bg-teal-700 px-4 py-2 text-sm font-bold text-white hover:bg-teal-800">{t('sales.applyFilters')}</button><button type="button" onClick={clearFilters} className="flex-1 rounded-lg border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50">{t('sales.clearFilters')}</button></div>
      </form>

      {actionError && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{actionError}</div>}

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
                  <td colSpan={user?.role === 'ADMIN' || user?.role === 'BRANCH_MANAGER' || user?.role === 'STAFF' ? 7 : 6} className="py-8 text-center text-slate-400">
                    {t('common.loading')}
                  </td>
                </tr>
              ) : loadError ? (
                <tr><td colSpan={user?.role === 'AUDITOR' ? 6 : 7} className="py-8 text-center text-red-700">{loadError} <button type="button" onClick={() => loadTransfers(page)} className="font-bold underline">{t('common.retry')}</button></td></tr>
              ) : transfers.length === 0 ? (
                <tr>
                  <td colSpan={user?.role === 'AUDITOR' ? 6 : 7} className="py-8 text-center text-slate-400">
                    {t('transfers.noMatches')}
                  </td>
                </tr>
              ) : (
                transfers.map((trf) => (
                  <tr key={trf.id} className="hover:bg-slate-50/70">
                    <td className="py-3 px-4 font-mono font-bold"><Link to={`/transfers/${trf.id}`} className="text-blue-700 hover:underline">{trf.transferNumber}</Link></td>
                    <td className="py-3 px-4 font-semibold text-slate-800">{trf.fromBranchName}</td>
                    <td className="py-3 px-4 font-semibold text-slate-800">{trf.toBranchName}</td>
                    <td className="py-3 px-4 text-slate-500">{formatDate(trf.requestedAt || trf.createdAt, i18n.language)}</td>
                    <td className="py-3 px-4 text-center font-bold">{trf.itemCount ?? trf.items?.length ?? 0}</td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                          trf.status === 'SHIPPED'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : trf.status === 'RECEIVED'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : trf.status === 'REJECTED'
                            ? 'bg-red-50 text-red-700 border border-red-200'
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
                          {trf.status === 'REQUESTED' && (user?.role === 'ADMIN' || (user?.role === 'BRANCH_MANAGER' && Number(user?.branchId) === Number(trf.fromBranchId))) && (
                            <button
                              type="button"
                              disabled={Boolean(actionLoading)}
                              onClick={() => handleApprove(trf.id)}
                              className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-blue-700"
                            >
                              {actionLoading === `${trf.id}:approve` ? t('common.loading') : t('transfers.approve')}
                            </button>
                          )}

                          {trf.status === 'REQUESTED' && (user?.role === 'ADMIN' || (user?.role === 'BRANCH_MANAGER' && Number(user?.branchId) === Number(trf.fromBranchId))) && <button type="button" disabled={Boolean(actionLoading)} onClick={() => { setRejectTransfer(trf); setRejectReason(''); setActionError('') }} className="rounded-lg border border-red-300 px-2.5 py-1 text-[11px] font-bold text-red-700 hover:bg-red-50">{t('transfers.reject')}</button>}

                          {trf.status === 'APPROVED' && (user?.role === 'ADMIN' || Number(user?.branchId) === Number(trf.fromBranchId)) && (
                            <button
                              type="button"
                              disabled={Boolean(actionLoading)}
                              onClick={() => handleShip(trf.id)}
                              className="inline-flex items-center gap-1 rounded-lg bg-amber-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-amber-700"
                            >
                              <Truck className="h-3 w-3" />
                              {t('transfers.ship')}
                            </button>
                          )}

                          {trf.status === 'SHIPPED' && (user?.role === 'ADMIN' || Number(user?.branchId) === Number(trf.toBranchId)) && (
                            <button
                              type="button"
                              disabled={Boolean(actionLoading)}
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
                              {t('transfers.completed')}
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
        {!loading && !loadError && total > 20 && <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-sm text-slate-600"><span>{t('transfers.pageSummary', { page, pageCount: Math.ceil(total / 20), total })}</span><div className="flex gap-2"><button type="button" disabled={page <= 1} onClick={() => loadTransfers(page - 1)} className="rounded-lg border border-slate-300 px-3 py-1.5 font-semibold disabled:opacity-40">{t('common.previous')}</button><button type="button" disabled={page >= Math.ceil(total / 20)} onClick={() => loadTransfers(page + 1)} className="rounded-lg border border-slate-300 px-3 py-1.5 font-semibold disabled:opacity-40">{t('common.next')}</button></div></div>}
      </div>

      {/* New Transfer Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl my-6 max-h-[90vh] overflow-y-auto" role="dialog" aria-modal="true" aria-labelledby="transfer-form-title">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 id="transfer-form-title" className="font-extrabold text-base text-slate-900">{t('transfers.newTransfer')}</h3>
              <button type="button" onClick={() => setShowModal(false)} aria-label={t('common.close')} className="text-slate-400 hover:text-slate-600 font-bold">
                ✕
              </button>
            </div>

            {errorMsg && (
              <div role="alert" className="mt-3 rounded-lg bg-red-50 p-2.5 text-xs font-semibold text-red-700 border border-red-200">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleCreateTransfer} className="mt-4 space-y-4 text-xs">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">{t('transfers.fromBranch')} *</label>
                  <select
                    required
                    value={fromBranchId}
                    onChange={(e) => setFromBranchId(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-blue-500 focus:outline-none"
                  >
                    <option value="">{t('transfers.selectSource')}</option>
                    {branches.filter((branch) => branch.isActive !== false && (user?.role === 'ADMIN' || branch.id !== Number(user?.branchId))).map((b) => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">{t('transfers.toBranch')} *</label>
                  {user?.role === 'ADMIN' ? <select
                    required
                    value={toBranchId}
                    onChange={(e) => setToBranchId(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-blue-500 focus:outline-none"
                  >
                    <option value="">{t('transfers.selectDestination')}</option>
                    {branches.filter((branch) => branch.isActive !== false).map((b) => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select> : <p className="rounded-lg bg-slate-50 px-3 py-2 text-slate-700">{branches.find((branch) => branch.id === Number(user?.branchId))?.name || user?.branchName || t('transfers.yourBranch')}</p>}
                </div>
              </div>

              {/* Items */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-slate-800">{t('transfers.itemsToTransfer')}</span>
                  <button
                    type="button"
                    onClick={addTransferItem}
                    className="text-[11px] font-bold text-blue-600 hover:underline flex items-center gap-1"
                  >
                    <Plus className="h-3 w-3" /> {t('transfers.addProduct')}
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
                        <option value="">{t('transfers.selectProduct')}</option>
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
                        aria-label={t('transfers.quantityFor', { product: products.find((product) => String(product.id) === String(item.productId))?.name || t('transfers.item') })}
                        placeholder={t('transfers.quantity')}
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
                          aria-label={t('transfers.removeProduct')}
                          className="text-slate-400 hover:text-red-600 p-1"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">{t('transfers.note')}</label>
                <textarea rows="2" maxLength={300} value={note} onChange={(event) => setNote(event.target.value)} placeholder={t('transfers.notePlaceholder')} className="w-full rounded-lg border border-slate-300 p-2.5 text-xs focus:border-blue-500 focus:outline-none" />
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
                  {submitting ? t('common.loading') : t('transfers.sendRequest')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {rejectTransfer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <form onSubmit={handleReject} className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="transfer-reject-title">
            <h3 id="transfer-reject-title" className="font-extrabold text-base text-slate-900">{t('transfers.reject')}</h3>
            <p className="mt-2 text-sm text-slate-600">{t('transfers.rejectPrompt', { transfer: rejectTransfer.transferNumber })}</p>
            <label className="mt-4 block text-xs font-bold text-slate-700">{t('transfers.rejectReason')}
              <textarea rows="3" maxLength={300} value={rejectReason} onChange={(event) => setRejectReason(event.target.value)} placeholder={t('transfers.rejectReasonPlaceholder')} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 text-sm" />
            </label>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setRejectTransfer(null)} className="rounded-xl border border-slate-300 px-4 py-2 font-bold text-slate-600">{t('common.cancel')}</button>
              <button type="submit" disabled={Boolean(actionLoading)} className="rounded-xl bg-red-600 px-4 py-2 font-bold text-white disabled:opacity-50">{actionLoading === `${rejectTransfer.id}:reject` ? t('common.loading') : t('transfers.confirmReject')}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
