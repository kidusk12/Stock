import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../auth/AuthContext'
import { api } from '../../lib/api'
import { formatETB } from '../../lib/ethiopianDate'

const cardClass = 'rounded-xl border border-[#cfdde3] bg-white p-4 shadow-clean'

function Metric({ label, value, note }) {
  return (
    <section className={cardClass}>
      <p className="text-xs font-medium text-[#728994]">{label}</p>
      <p className="mt-2 text-2xl font-bold text-[#15343f]">{value}</p>
      {note && <p className="mt-1 text-xs text-[#728994]">{note}</p>}
    </section>
  )
}

function ListCard({ title, rows, empty, children }) {
  return (
    <section className={cardClass}>
      <h3 className="mb-3 text-sm font-bold text-[#15343f]">{title}</h3>
      {children || (rows?.length ? (
        <ul className="divide-y divide-[#edf3f6]">
          {rows.map((row, index) => <li key={row.id ?? row.productId ?? index} className="flex items-center justify-between gap-3 py-2 text-sm">
            <span className="min-w-0 truncate text-[#486370]">{row.label}</span>
            <span className="shrink-0 font-semibold text-[#15343f]">{row.value}</span>
          </li>)}
        </ul>
      ) : <p className="text-sm text-[#728994]">{empty}</p>)}
    </section>
  )
}

function auditEntityType(item) {
  const suppliedType = item.entityType ?? item.entity?.type ?? item.entity
  if (typeof suppliedType === 'string' && suppliedType) return suppliedType
  const actionPrefix = String(item.action || '').split('_')[0]
  return ({ PO: 'PO', SALE: 'SALE', RETURN: 'RETURN', ADJUSTMENT: 'ADJUSTMENT', TRANSFER: 'TRANSFER', PRODUCT: 'PRODUCT', USER: 'USER', SUPPLIER: 'SUPPLIER', BRANCH: 'BRANCH', IMPORT: 'IMPORT' })[actionPrefix] || ''
}

export default function Dashboard() {
  const { user, selectedBranchId } = useAuth()
  const { t, i18n } = useTranslation()
  const [dashboard, setDashboard] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(false)
    api.get('/dashboard', { branchId: user?.role === 'ADMIN' ? selectedBranchId : undefined })
      .then((data) => { if (active) setDashboard(data) })
      .catch(() => { if (active) setError(true) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [selectedBranchId, user?.role])

  const widgets = dashboard?.widgets || {}
  const money = (value) => formatETB(Number(value || 0), i18n.language)
  const title = t('dashboard.title')

  if (loading) return <div className="mx-auto max-w-7xl p-6 text-sm text-[#728994]" role="status">{t('dashboard.loading')}</div>
  if (error || !dashboard) return <div className="mx-auto max-w-7xl rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-800" role="alert">{t('dashboard.loadError')}</div>

  if (dashboard.role === 'AUDITOR') {
    const activity = (widgets.recentAuditActivity || []).map((item) => ({
      id: item.id,
      label: `${t(`audit.actions.${item.action}`, { defaultValue: item.action || '—' })} · ${t(`audit.entityTypes.${auditEntityType(item)}`, { defaultValue: auditEntityType(item) || '—' })}${item.branchName ? ` · ${item.branchName}` : ''}`,
      value: item.createdBy?.name || item.user || '',
    }))
    const adjustments = (widgets.recentAdjustments || []).map((item) => ({
      id: item.id,
      label: `${item.productName} · ${t(`reasons.${item.reason}`, { defaultValue: item.reason })}`,
      value: `${Number(item.quantity ?? item.quantityChange) > 0 ? '+' : ''}${Number(item.quantity ?? item.quantityChange) || 0}`,
    }))
    return <main className="mx-auto max-w-7xl space-y-5 pb-8">
      <h1 className="text-xl font-bold text-[#15343f]">{title}</h1>
      <p className="text-sm text-[#728994]">{t('dashboard.readOnly')}</p>
      <div className="grid gap-4 lg:grid-cols-2">
        <ListCard title={t('dashboard.recentAuditActivity')} rows={activity} empty={t('dashboard.noActivity')} />
        <ListCard title={t('dashboard.recentAdjustments')} rows={adjustments} empty={t('dashboard.noAdjustments')} />
      </div>
    </main>
  }

  if (dashboard.role === 'STAFF') {
    const sales = widgets.salesToday || widgets.salesSummary || widgets.todaySales || { count: 0, total: 0 }
    const invoiceCount = Number(sales.invoiceCount ?? sales.count ?? sales.salesCount ?? 0)
    const expectedOrders = (widgets.expectedPurchaseOrders || []).map((item) => ({ id: item.id, label: item.poNumber, value: t(`status.${item.status}`, { defaultValue: item.status }) }))
    const transfers = (widgets.pendingTransfers || []).map((item) => ({ id: item.id, label: item.transferNumber, value: t(`status.${item.status}`, { defaultValue: item.status }) }))
    return <main className="mx-auto max-w-7xl space-y-5 pb-8">
      <h1 className="text-xl font-bold text-[#15343f]">{title}</h1>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Metric label={t('dashboard.todaySales')} value={money(sales.total ?? sales.totalAmount)} />
        <Metric label={t('dashboard.invoiceCountLabel')} value={invoiceCount} />
        <section className={`${cardClass} flex flex-col justify-between`}>
          <p className="text-sm font-bold text-[#15343f]">{t('dashboard.findProduct')}</p>
          <div className="mt-3 flex gap-2">
            <span className="min-w-0 flex-1 rounded-lg border border-[#cfdde3] px-3 py-2 text-sm text-[#728994]">{t('dashboard.searchProduct')}</span>
            <Link className="rounded-lg bg-[#173d4a] px-3 py-2 text-sm font-semibold text-white" to="/sales">{t('dashboard.newSale')}</Link>
          </div>
        </section>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <ListCard title={t('dashboard.expectedPurchaseOrders')} rows={expectedOrders} empty={t('dashboard.noExpectedOrders')} />
        <ListCard title={t('dashboard.pendingTransfers')} rows={transfers} empty={t('dashboard.noPendingTransfers')} />
      </div>
    </main>
  }

  const sales = widgets.salesToday || widgets.salesSummary || { count: 0, total: 0 }
  const lowStock = (widgets.lowStockItems || []).map((item) => ({ id: item.productId, label: item.productName, value: `${item.quantity} / ${item.minQuantity}` }))
  const branchRows = (widgets.branchComparison || []).map((item) => ({ id: item.branchId, label: item.branchName || item.name, value: money(item.total ?? item.value) }))
  const recent = (widgets.recentActivity || []).map((item) => ({
    id: item.id,
    label: `${t(`audit.actions.${item.action}`, { defaultValue: item.action || '—' })} · ${t(`audit.entityTypes.${auditEntityType(item)}`, { defaultValue: auditEntityType(item) || '—' })}${item.branchName ? ` · ${item.branchName}` : ''}`,
    value: item.createdBy?.name || item.user || '',
  }))
  const manager = dashboard.role === 'BRANCH_MANAGER'
  const metrics = [
    <Metric key="value" label={t('dashboard.totalStockValue')} value={money(widgets.stockValue)} />,
    <Metric key="sales" label={t('dashboard.todaySales')} value={money(sales.total)} note={t('dashboard.invoiceCount', { count: sales.count })} />,
    <Metric key="low" label={t('dashboard.lowStockCount')} value={widgets.lowStockCount ?? lowStock.length} />,
    manager
      ? <Metric key="approvals" label={t('dashboard.pendingApprovals')} value={(widgets.pendingApprovals?.purchaseOrders || 0) + (widgets.pendingApprovals?.transfers || 0)} note={t('dashboard.approvalBreakdown', { purchaseOrders: widgets.pendingApprovals?.purchaseOrders || 0, transfers: widgets.pendingApprovals?.transfers || 0 })} />
      : <Metric key="refunds" label={t('dashboard.pendingRefunds')} value={widgets.pendingRefunds?.count || 0} note={money(widgets.pendingRefunds?.totalAmount)} />,
  ]

  return <main className="mx-auto max-w-7xl space-y-5 pb-8">
    <h1 className="text-xl font-bold text-[#15343f]">{title}</h1>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{metrics}</div>
    {manager ? <div className="grid gap-4 lg:grid-cols-2">
      <ListCard title={t('dashboard.lowStockItems')} rows={lowStock} empty={t('dashboard.noLowStock')} />
      <Metric label={t('dashboard.transfersInTransit')} value={widgets.transfersInTransit || 0} />
    </div> : <div className="grid gap-4 lg:grid-cols-2">
      <ListCard title={t('dashboard.branchComparison')} rows={branchRows} empty={t('dashboard.noBranchSales')} />
      <ListCard title={t('dashboard.recentActivity')} rows={recent} empty={t('dashboard.noActivity')} />
    </div>}
  </main>
}
