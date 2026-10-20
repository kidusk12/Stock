import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, CalendarDays, PackageCheck, Store, Truck } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { api } from '../../lib/api'
import { formatDate, formatETB } from '../../lib/ethiopianDate'

const statusClasses = {
  PENDING_APPROVAL: 'border-amber-200 bg-amber-50 text-amber-800',
  APPROVED: 'border-blue-200 bg-blue-50 text-blue-800',
  REJECTED: 'border-red-200 bg-red-50 text-red-800',
  PARTIALLY_RECEIVED: 'border-indigo-200 bg-indigo-50 text-indigo-800',
  RECEIVED: 'border-emerald-200 bg-emerald-50 text-emerald-800',
}

function personName(person, legacyName) {
  return person?.name || legacyName || ''
}

export default function PurchaseDetail() {
  const { purchaseOrderId } = useParams()
  const { t, i18n } = useTranslation()
  const [order, setOrder] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadOrder = useCallback(() => {
    setLoading(true)
    setError('')
    api.get(`/purchase-orders/${purchaseOrderId}`)
      .then(setOrder)
      .catch((err) => setError(t(`errors.${err.code}`, { defaultValue: t('purchases.detailLoadError') })))
      .finally(() => setLoading(false))
  }, [purchaseOrderId, t])

  useEffect(() => {
    loadOrder()
  }, [loadOrder])

  if (loading) {
    return <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500" role="status">{t('common.loading')}</div>
  }

  if (error || !order) {
    return (
      <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6">
        <p role="alert" className="text-sm text-red-700">{error || t('purchases.detailLoadError')}</p>
        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={loadOrder} className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-bold text-white">{t('common.retry')}</button>
          <Link to="/purchases" className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700">{t('purchases.backToList')}</Link>
        </div>
      </section>
    )
  }

  const receivedBy = personName(order.receivedBy, order.receivedByName)
  const createdBy = personName(order.createdBy, order.createdByName)
  const approvedBy = personName(order.approvedBy, order.approvedByName)
  const rejectedBy = personName(order.rejectedBy, order.rejectedByName)

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link to="/purchases" className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-teal-800 hover:underline">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />{t('purchases.backToList')}
          </Link>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">{t('purchases.detailTitle')} · {order.poNumber}</h1>
        </div>
        <span className={`inline-flex w-fit rounded-full border px-3 py-1.5 text-sm font-bold ${statusClasses[order.status] || 'border-slate-200 bg-slate-50 text-slate-700'}`}>
          {t(`status.${order.status}`, { defaultValue: order.status })}
        </span>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label={t('purchases.orderInformation')}>
        <InfoCard icon={Truck} label={t('purchases.supplier')} value={order.supplierName} />
        <InfoCard icon={Store} label={t('purchases.branch')} value={order.branchName} />
        <InfoCard icon={CalendarDays} label={t('purchases.orderDate')} value={formatDate(order.createdAt, i18n.language)} />
        <InfoCard icon={PackageCheck} label={t('purchases.totalCost')} value={formatETB(order.totalCost, i18n.language)} />
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-soft">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="font-extrabold text-slate-900">{t('purchases.items')}</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-600">
              <tr>
                <th className="px-5 py-3">{t('purchases.product')}</th>
                <th className="px-5 py-3">{t('purchases.sku')}</th>
                <th className="px-5 py-3 text-right">{t('purchases.orderedQty')}</th>
                <th className="px-5 py-3 text-right">{t('purchases.receivedQty')}</th>
                <th className="px-5 py-3 text-right">{t('purchases.remainingQty')}</th>
                <th className="px-5 py-3 text-right">{t('purchases.unitCost')}</th>
                <th className="px-5 py-3 text-right">{t('purchases.lineTotal')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {(order.items || []).map((item) => {
                const remaining = Math.max(0, Number(item.quantity || 0) - Number(item.receivedQuantity || 0))
                return (
                  <tr key={item.id}>
                    <td className="px-5 py-3 font-semibold text-slate-900">{item.productName}</td>
                    <td className="px-5 py-3 font-mono text-xs">{item.sku || '—'}</td>
                    <td className="px-5 py-3 text-right tabular-nums">{item.quantity}</td>
                    <td className="px-5 py-3 text-right tabular-nums">{item.receivedQuantity || 0}</td>
                    <td className="px-5 py-3 text-right tabular-nums">{remaining}</td>
                    <td className="px-5 py-3 text-right tabular-nums">{formatETB(item.unitCost, i18n.language)}</td>
                    <td className="px-5 py-3 text-right font-semibold tabular-nums">{formatETB(Number(item.quantity) * Number(item.unitCost), i18n.language)}</td>
                  </tr>
                )
              })}
              {(!order.items || order.items.length === 0) && <tr><td colSpan="7" className="px-5 py-8 text-center text-slate-500">{t('common.noData')}</td></tr>}
            </tbody>
            <tfoot className="border-t border-slate-200 bg-slate-50 font-extrabold text-slate-900">
              <tr><td colSpan="6" className="px-5 py-3 text-right">{t('purchases.totalCost')}</td><td className="px-5 py-3 text-right">{formatETB(order.totalCost, i18n.language)}</td></tr>
            </tfoot>
          </table>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft">
        <h2 className="font-extrabold text-slate-900">{t('purchases.activity')}</h2>
        <dl className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <Activity label={t('purchases.createdBy')} name={createdBy} date={order.createdAt} language={i18n.language} />
          {approvedBy && <Activity label={t('purchases.approvedBy')} name={approvedBy} date={order.approvedAt} language={i18n.language} />}
          {rejectedBy && <Activity label={t('purchases.rejectedBy')} name={rejectedBy} date={order.rejectedAt} language={i18n.language} />}
          {receivedBy && <Activity label={t('purchases.receivedBy')} name={receivedBy} date={order.receivedAt} language={i18n.language} />}
        </dl>
        {order.rejectReason && <p className="mt-4 rounded-xl border border-red-100 bg-red-50 p-3 text-sm text-red-800"><strong>{t('purchases.rejectReason')}:</strong> {order.rejectReason}</p>}
      </section>
    </div>
  )
}

function InfoCard({ icon: Icon, label, value }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-soft">
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500"><Icon className="h-4 w-4 text-teal-700" aria-hidden="true" />{label}</div>
      <p className="mt-2 font-semibold text-slate-900">{value || '—'}</p>
    </div>
  )
}

function Activity({ label, name, date, language }) {
  return (
    <div>
      <dt className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-1 font-semibold text-slate-900">{name || '—'}</dd>
      {date && <dd className="mt-0.5 text-sm text-slate-500">{formatDate(date, language)}</dd>}
    </div>
  )
}
