import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../auth/AuthContext'
import { api } from '../../lib/api'
import { useFormatBirr } from '../../lib/money'
import { useFormatDate } from '../../lib/dateFormat'

const Card = ({ label, value }) => <div className="rounded-xl border bg-white p-4 shadow-sm">
  <div className="text-sm text-slate-500">{label}</div><div className="mt-1 text-2xl font-semibold">{value}</div>
</div>

export default function Dashboard() {
  const { selectedBranchId, user } = useAuth()
  const { t, i18n } = useTranslation()
  const formatMoney = useFormatBirr()
  const formatDate = useFormatDate()
  const [widgets, setWidgets] = useState({})
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    api.get('/dashboard', { branchId: selectedBranchId }).then((data) => { if (active) setWidgets(data.widgets || {}) })
      .catch((e) => { if (active) setError(e.message || t('errors.SERVER_ERROR')) })
    return () => { active = false }
  }, [selectedBranchId, t])
  const cards = []
  if (widgets.stockValue !== undefined) cards.push([t('dashboard.stockValue', 'Stock value'), formatMoney(widgets.stockValue)])
  if (widgets.salesToday) cards.push([t('dashboard.salesToday', 'Sales today'), `${widgets.salesToday.count} · ${formatMoney(widgets.salesToday.total)}`])
  if (widgets.salesSummary) cards.push([t('dashboard.salesToday', 'Sales summary'), `${widgets.salesSummary.count} · ${formatMoney(widgets.salesSummary.total)}`])
  if (widgets.pendingApprovals) cards.push([t('dashboard.pendingApprovals', 'Pending approvals'), `${widgets.pendingApprovals.purchaseOrders} · ${widgets.pendingApprovals.transfers}`])
  if (widgets.transfersInTransit !== undefined) cards.push([t('dashboard.transfersInTransit', 'Transfers in transit'), widgets.transfersInTransit])
  if (widgets.pendingRefunds) cards.push([t('dashboard.pendingRefunds', 'Pending refunds'), `${widgets.pendingRefunds.count} · ${formatMoney(widgets.pendingRefunds.totalAmount)}`])
  if (widgets.lowStockCount !== undefined) cards.push([t('dashboard.lowStock', 'Low stock items'), widgets.lowStockCount])
  if (widgets.expectedPurchaseOrders !== undefined) cards.push([t('dashboard.expectedPurchaseOrders', 'Expected purchase orders'), widgets.expectedPurchaseOrders])
  if (widgets.pendingTransfers !== undefined) cards.push([t('dashboard.pendingTransfers', 'Pending transfers'), widgets.pendingTransfers])
  return <section className="mx-auto max-w-7xl space-y-6">
    <div><h1 className="text-2xl font-bold">{t('nav.dashboard')}</h1><p className="text-sm text-slate-500">{user?.fullName}</p></div>
    {error && <p role="alert" className="rounded border border-red-200 bg-red-50 p-3 text-red-700">{error}</p>}
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{cards.map(([label, value]) => <Card key={label} label={label} value={value} />)}</div>
    {widgets.lowStockItems?.length > 0 && <section className="rounded-xl border bg-white p-4"><h2 className="mb-3 font-semibold">{t('lowStock.title')}</h2>
      <div className="divide-y">{widgets.lowStockItems.map((item) => <div key={`${item.branchId}-${item.productId}`} className="flex justify-between py-2 text-sm"><span>{item.productName}{item.branchName ? ` · ${item.branchName}` : ''}</span><span>{item.quantity} / {item.minQuantity}</span></div>)}</div>
    </section>}
    {widgets.branchComparison?.length > 0 && <section className="rounded-xl border bg-white p-4"><h2 className="mb-3 font-semibold">{t('dashboard.branchComparison', 'Branch comparison')}</h2>
      <div className="divide-y">{widgets.branchComparison.map((branch) => <div key={branch.branchId} className="flex justify-between py-2 text-sm"><span>{branch.branchName}</span><span>{formatMoney(branch.stockValue)}</span></div>)}</div>
    </section>}
    {widgets.recentAuditActivity?.length > 0 && <section className="rounded-xl border bg-white p-4"><h2 className="mb-3 font-semibold">{t('audit.title')}</h2>
      <div className="divide-y">{widgets.recentAuditActivity.map((entry) => <div key={entry.id} className="flex justify-between py-2 text-sm"><span>{entry.action} · {entry.user?.name}</span><span>{formatDate(entry.createdAt, i18n.language)}</span></div>)}</div>
    </section>}
  </section>
}
