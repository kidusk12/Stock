import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, CalendarDays, CheckCircle2, Package, Store, Truck } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../auth/AuthContext'
import { api } from '../../lib/api'
import { formatDate } from '../../lib/ethiopianDate'

const statusClasses = {
  REQUESTED: 'border-amber-200 bg-amber-50 text-amber-800',
  APPROVED: 'border-blue-200 bg-blue-50 text-blue-800',
  REJECTED: 'border-red-200 bg-red-50 text-red-800',
  SHIPPED: 'border-indigo-200 bg-indigo-50 text-indigo-800',
  RECEIVED: 'border-emerald-200 bg-emerald-50 text-emerald-800',
}

function personName(person, legacyName) {
  return person?.fullName || person?.name || legacyName || ''
}

export default function TransferDetail() {
  const { transferId } = useParams()
  const { user } = useAuth()
  const { t, i18n } = useTranslation()
  const [transfer, setTransfer] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionError, setActionError] = useState('')
  const [actionLoading, setActionLoading] = useState(false)
  const [showRejectForm, setShowRejectForm] = useState(false)
  const [showReceiveForm, setShowReceiveForm] = useState(false)
  const [receiveQuantities, setReceiveQuantities] = useState({})
  const [rejectReason, setRejectReason] = useState('')

  const loadTransfer = useCallback(() => {
    setLoading(true)
    setError('')
    api.get(`/transfers/${transferId}`)
      .then((nextTransfer) => {
        setTransfer(nextTransfer)
        setReceiveQuantities(Object.fromEntries((nextTransfer.items || []).map((item) => [item.productId, String(item.quantity)])))
      })
      .catch((err) => setError(t(`errors.${err.code}`, { defaultValue: t('transfers.detailLoadError') })))
      .finally(() => setLoading(false))
  }, [transferId, t])

  useEffect(() => { loadTransfer() }, [loadTransfer])

  const performAction = async (action, body) => {
    setActionError('')
    setActionLoading(true)
    try {
      await api.post(`/transfers/${transferId}/${action}`, body)
      setShowRejectForm(false)
      setShowReceiveForm(false)
      setRejectReason('')
      loadTransfer()
    } catch (err) {
      setActionError(t(`errors.${err.code}`, { defaultValue: t(`transfers.${action}Error`) }))
    } finally {
      setActionLoading(false)
    }
  }

  const submitReject = (event) => {
    event.preventDefault()
    performAction('reject', { reason: rejectReason.trim() || undefined })
  }

  const submitReceipt = (event) => {
    event.preventDefault()
    const items = (transfer.items || []).map((item) => ({
      productId: Number(item.productId),
      quantity: Number(receiveQuantities[item.productId]),
    }))
    performAction('receive', { items })
  }

  if (loading) return <div role="status" className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">{t('common.loading')}</div>

  if (error || !transfer) {
    return (
      <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6">
        <p role="alert" className="text-sm text-red-700">{error || t('transfers.detailLoadError')}</p>
        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={loadTransfer} className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-bold text-white">{t('common.retry')}</button>
          <Link to="/transfers" className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700">{t('transfers.backToList')}</Link>
        </div>
      </section>
    )
  }

  const sourceUser = Number(user?.branchId) === Number(transfer.fromBranchId)
  const destinationUser = Number(user?.branchId) === Number(transfer.toBranchId)
  const isAdmin = user?.role === 'ADMIN'
  const canApprove = transfer.status === 'REQUESTED' && (isAdmin || (user?.role === 'BRANCH_MANAGER' && sourceUser))
  const canShip = transfer.status === 'APPROVED' && (isAdmin || (['BRANCH_MANAGER', 'STAFF'].includes(user?.role) && sourceUser))
  const canReceive = transfer.status === 'SHIPPED' && (isAdmin || (['BRANCH_MANAGER', 'STAFF'].includes(user?.role) && destinationUser))
  const requestedBy = personName(transfer.requestedBy, transfer.requestedByName)
  const approvedBy = personName(transfer.approvedBy, transfer.approvedByName)
  const rejectedBy = personName(transfer.rejectedBy, transfer.rejectedByName)
  const shippedBy = personName(transfer.shippedBy, transfer.shippedByName)
  const receivedBy = personName(transfer.receivedBy, transfer.receivedByName)
  const activity = [
    { key: 'requested', label: t('transfers.requestedBy'), name: requestedBy, date: transfer.requestedAt || transfer.createdAt },
    { key: 'approved', label: t('transfers.approvedBy'), name: approvedBy, date: transfer.approvedAt },
    { key: 'rejected', label: t('transfers.rejectedBy'), name: rejectedBy, date: transfer.rejectedAt },
    { key: 'shipped', label: t('transfers.shippedBy'), name: shippedBy, date: transfer.shippedAt },
    { key: 'received', label: t('transfers.receivedBy'), name: receivedBy, date: transfer.receivedAt },
  ].filter((step) => step.name || step.date)

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link to="/transfers" className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-teal-800 hover:underline">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />{t('transfers.backToList')}
          </Link>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">{t('transfers.detailTitle')} · {transfer.transferNumber}</h1>
        </div>
        <span className={`inline-flex w-fit rounded-full border px-3 py-1.5 text-sm font-bold ${statusClasses[transfer.status] || 'border-slate-200 bg-slate-50 text-slate-700'}`}>
          {t(`status.${transfer.status}`, { defaultValue: transfer.status })}
        </span>
      </header>

      {actionError && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{actionError}</div>}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-label={t('transfers.transferInformation')}>
        <InfoCard icon={Store} label={t('transfers.fromBranch')} value={transfer.fromBranchName} />
        <InfoCard icon={Store} label={t('transfers.toBranch')} value={transfer.toBranchName} />
        <InfoCard icon={CalendarDays} label={t('transfers.requestedAt')} value={formatDate(transfer.requestedAt || transfer.createdAt, i18n.language)} />
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-soft">
        <div className="flex items-center gap-2 border-b border-slate-200 px-5 py-4">
          <Package className="h-4 w-4 text-teal-700" aria-hidden="true" />
          <h2 className="font-extrabold text-slate-900">{t('transfers.itemsToTransfer')}</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-600"><tr>
              <th className="px-5 py-3">{t('transfers.product')}</th>
              <th className="px-5 py-3">{t('transfers.sku')}</th>
              <th className="px-5 py-3 text-right">{t('transfers.quantity')}</th>
            </tr></thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {(transfer.items || []).map((item) => <tr key={item.id || item.productId}>
                <td className="px-5 py-3 font-semibold text-slate-900">{item.productName || item.product?.name || '—'}
                  {transfer.status === 'RECEIVED' && item.receivedQuantity != null && <div className="mt-1 text-xs font-normal text-slate-600">{t('transfers.receivedQuantityValue', { quantity: item.receivedQuantity })}</div>}
                  {transfer.status === 'RECEIVED' && item.discrepancyQuantity !== 0 && item.discrepancyQuantity != null && <div role="status" className="mt-1 text-xs font-semibold text-amber-800">{t('transfers.receiptDiscrepancyLine', { shipped: item.quantity, received: item.receivedQuantity, difference: item.discrepancyQuantity })}</div>}
                </td>
                <td className="px-5 py-3 font-mono text-xs">{item.sku || item.product?.sku || '—'}</td>
                <td className="px-5 py-3 text-right tabular-nums">{item.quantity}</td>
              </tr>)}
              {(!transfer.items || transfer.items.length === 0) && <tr><td colSpan="3" className="px-5 py-8 text-center text-slate-500">{t('common.noData')}</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      {transfer.note && <section className="rounded-2xl border border-slate-200 bg-white p-5"><h2 className="font-extrabold text-slate-900">{t('transfers.note')}</h2><p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{transfer.note}</p></section>}
      {transfer.rejectReason && <p className="rounded-xl border border-red-100 bg-red-50 p-3 text-sm text-red-800"><strong>{t('transfers.rejectReason')}:</strong> {transfer.rejectReason}</p>}

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft">
        <h2 className="font-extrabold text-slate-900">{t('transfers.activity')}</h2>
        <dl className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {activity.map((step) => <Activity key={step.key} label={step.label} name={step.name} date={step.date} language={i18n.language} />)}
        </dl>
      </section>

      {(canApprove || canShip || canReceive) && <section className="flex flex-wrap gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-soft" aria-label={t('common.actions')}>
        {canApprove && <button type="button" disabled={actionLoading} onClick={() => performAction('approve')} className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50">{actionLoading ? t('common.loading') : t('transfers.approve')}</button>}
        {canApprove && !showRejectForm && <button type="button" disabled={actionLoading} onClick={() => setShowRejectForm(true)} className="rounded-xl border border-red-300 px-4 py-2 text-sm font-bold text-red-700 hover:bg-red-50 disabled:opacity-50">{t('transfers.reject')}</button>}
        {canShip && <button type="button" disabled={actionLoading} onClick={() => performAction('ship')} className="inline-flex items-center gap-2 rounded-xl bg-amber-600 px-4 py-2 text-sm font-bold text-white hover:bg-amber-700 disabled:opacity-50"><Truck className="h-4 w-4" aria-hidden="true" />{actionLoading ? t('common.loading') : t('transfers.ship')}</button>}
        {canReceive && !showReceiveForm && <button type="button" disabled={actionLoading} onClick={() => setShowReceiveForm(true)} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50"><CheckCircle2 className="h-4 w-4" aria-hidden="true" />{t('transfers.confirmReceipt')}</button>}
        {showReceiveForm && canReceive && <form onSubmit={submitReceipt} className="w-full space-y-3 border-t border-slate-200 pt-4">
          <p className="text-sm text-slate-600">{t('transfers.receiveHelp')}</p>
          {(transfer.items || []).map((item) => <label key={item.id || item.productId} className="flex flex-wrap items-center justify-between gap-3 text-sm font-semibold text-slate-700">
            <span>{item.productName || item.product?.name || '—'} <span className="font-normal text-slate-500">({t('transfers.shippedQuantityValue', { quantity: item.quantity })})</span></span>
            <input type="number" min="0" step="0.01" required value={receiveQuantities[item.productId] ?? ''} aria-label={t('transfers.receivedQuantityFor', { product: item.productName || item.product?.name || '' })} onChange={(event) => setReceiveQuantities((previous) => ({ ...previous, [item.productId]: event.target.value }))} className="w-28 rounded-lg border border-slate-300 px-3 py-2 text-right tabular-nums" />
          </label>)}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setShowReceiveForm(false)} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700">{t('common.cancel')}</button>
            <button type="submit" disabled={actionLoading} className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{actionLoading ? t('common.loading') : t('transfers.confirmReceipt')}</button>
          </div>
        </form>}
        {showRejectForm && canApprove && <form onSubmit={submitReject} className="flex w-full flex-col gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:items-end">
          <label className="flex-1 text-sm font-semibold text-slate-700">{t('transfers.rejectReason')}
            <textarea rows="2" maxLength={300} value={rejectReason} onChange={(event) => setRejectReason(event.target.value)} placeholder={t('transfers.rejectReasonPlaceholder')} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 text-sm" />
          </label>
          <button type="button" onClick={() => setShowRejectForm(false)} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700">{t('common.cancel')}</button>
          <button type="submit" disabled={actionLoading} className="rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{actionLoading ? t('common.loading') : t('transfers.confirmReject')}</button>
        </form>}
      </section>}
    </div>
  )
}

function InfoCard({ icon: Icon, label, value }) {
  return <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-soft"><div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500"><Icon className="h-4 w-4 text-teal-700" aria-hidden="true" />{label}</div><p className="mt-2 font-semibold text-slate-900">{value || '—'}</p></div>
}

function Activity({ label, name, date, language }) {
  return <div><dt className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</dt><dd className="mt-1 font-semibold text-slate-900">{name || '—'}</dd>{date && <dd className="mt-0.5 text-sm text-slate-500">{formatDate(date, language)}</dd>}</div>
}
