import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../auth/AuthContext'
import { api } from '../../lib/api'
import { formatETB, formatDate } from '../../lib/ethiopianDate'
import { errorKey } from '../../lib/errorMessages'
import {
  Download,
  Printer,
  Boxes
} from 'lucide-react'

const PAGE_SIZE = 20

export default function ReportsView() {
  const { user, selectedBranchId } = useAuth()
  const { t, i18n } = useTranslation()
  const [activeReport, setActiveReport] = useState('balance') // 'balance', 'movement', 'sales'
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState('')
  const [reportResult, setReportResult] = useState(null)
  const [page, setPage] = useState(1)
  const [reloadKey, setReloadKey] = useState(0)
  const [products, setProducts] = useState([])
  const [filters, setFilters] = useState({ from: '', to: '', productId: '' })
  const requestKey = JSON.stringify({ activeReport, selectedBranchId, filters, reloadKey, page })
  const currentResult = reportResult?.key === requestKey ? reportResult : null
  const data = currentResult?.data || []
  const summary = currentResult?.summary || null
  const loading = !currentResult
  const loadError = currentResult?.error || false
  useEffect(() => {
    let cancelled = false
    let endpoint = '/reports/stock'
    if (activeReport === 'movement') endpoint = '/reports/movements'
    if (activeReport === 'sales') endpoint = '/reports/sales'

    api.get(endpoint, {
      branchId: selectedBranchId || undefined,
      productId: filters.productId || undefined,
      from: activeReport === 'balance' ? undefined : filters.from || undefined,
      to: activeReport === 'balance' ? undefined : filters.to || undefined,
      page,
      limit: PAGE_SIZE,
    })
      .then((res) => {
        if (cancelled) return
        setReportResult({
          key: requestKey,
          data: Array.isArray(res?.data) ? res.data : [],
          summary: res?.totals || res?.summary || { totalValuation: res?.totalValuation },
          total: Number(res?.total) || 0,
          page: Number(res?.page) || page,
          limit: Number(res?.limit) || PAGE_SIZE,
          error: false,
        })
      })
      .catch(() => { if (!cancelled) setReportResult({ key: requestKey, data: [], summary: null, total: 0, page, limit: PAGE_SIZE, error: true }) })
    return () => { cancelled = true }
  }, [activeReport, selectedBranchId, filters, reloadKey, requestKey, page])

  useEffect(() => { setPage(1) }, [selectedBranchId])

  useEffect(() => {
    let cancelled = false
    const loadProducts = async () => {
      const allProducts = []
      let pageNumber = 1
      let total = Infinity
      while (allProducts.length < total) {
        const result = await api.get('/products', { limit: 100, page: pageNumber })
        const rows = Array.isArray(result?.data) ? result.data : []
        allProducts.push(...rows)
        total = Number(result?.total) || rows.length
        if (!rows.length) break
        pageNumber += 1
      }
      if (!cancelled) setProducts(allProducts)
    }
    loadProducts().catch(() => { if (!cancelled) setProducts([]) })
    return () => { cancelled = true }
  }, [])

  const exportToCsv = async () => {
    setExporting(true)
    setExportError('')
    try {
      const reportType = activeReport === 'balance' ? 'stock' : activeReport === 'movement' ? 'movements' : 'sales'
      const params = new URLSearchParams({ format: 'csv', lang: i18n.language === 'am' ? 'am' : 'en' })
      if (selectedBranchId) params.set('branchId', selectedBranchId)
      if (filters.productId) params.set('productId', filters.productId)
      if (activeReport !== 'balance' && filters.from) params.set('from', filters.from)
      if (activeReport !== 'balance' && filters.to) params.set('to', filters.to)
      const blob = await api.download(`/reports/${reportType}?${params.toString()}`)
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `berhan_${activeReport}_report.csv`
      document.body.appendChild(link)
      link.click()
      link.remove()
      setTimeout(() => URL.revokeObjectURL(url), 0)
    } catch (error) {
      setExportError(t(errorKey(error)))
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 no-print">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            {t('reports.title')}
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            {t('reports.description')}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={exportToCsv}
            disabled={exporting || loading || loadError}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50 transition disabled:opacity-50"
          >
            <Download className="h-4 w-4 text-blue-600" />
            {t(exporting ? 'reports.exportingCsv' : 'reports.exportCsv')}
          </button>
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-bold text-white shadow-sm hover:bg-blue-700 transition"
          >
            <Printer className="h-4 w-4" />
            {t('reports.printReport')}
          </button>
        </div>
      </div>

      {exportError && <p role="alert" className="no-print text-sm text-red-700">{exportError}</p>}

      <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-4 no-print">
        {activeReport !== 'balance' && <>
          <label className="text-xs font-bold text-slate-700">
            {t('reports.startDate')}
            <input type="date" value={filters.from} max={filters.to || undefined} onChange={(e) => { setPage(1); setFilters((prev) => ({ ...prev, from: e.target.value })) }} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </label>
          <label className="text-xs font-bold text-slate-700">
            {t('reports.endDate')}
            <input type="date" value={filters.to} min={filters.from || undefined} onChange={(e) => { setPage(1); setFilters((prev) => ({ ...prev, to: e.target.value })) }} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </label>
        </>}
        <label className="text-xs font-bold text-slate-700">
          {t('reports.product')}
          <select value={filters.productId} onChange={(e) => { setPage(1); setFilters((prev) => ({ ...prev, productId: e.target.value })) }} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
            <option value="">{t('reports.allProducts')}</option>
            {products.map((product) => <option key={product.id} value={product.id}>{product.name} ({product.sku})</option>)}
          </select>
        </label>
        {(filters.from || filters.to || filters.productId) && (
          <button type="button" onClick={() => { setPage(1); setFilters({ from: '', to: '', productId: '' }) }} className="self-end rounded-lg border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50">
            {t('reports.clearFilters')}
          </button>
        )}
      </div>

      {/* Report Tabs */}
      <div className="flex rounded-2xl bg-slate-200/60 p-1.5 text-xs font-bold gap-1 no-print">
        <button
          onClick={() => { setActiveReport('balance'); setPage(1) }}
          className={`flex-1 py-2 rounded-xl transition text-center ${
            activeReport === 'balance'
              ? 'bg-white text-blue-800 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          {t('reports.stockBalance')}
        </button>
        <button
          onClick={() => { setActiveReport('movement'); setPage(1) }}
          className={`flex-1 py-2 rounded-xl transition text-center ${
            activeReport === 'movement'
              ? 'bg-white text-blue-800 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          {t('reports.stockMovement')}
        </button>
        <button
          onClick={() => { setActiveReport('sales'); setPage(1) }}
          className={`flex-1 py-2 rounded-xl transition text-center ${
            activeReport === 'sales'
              ? 'bg-white text-blue-800 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          {t('reports.salesReport')}
        </button>
      </div>

      <div className="printable-area rounded-2xl border border-slate-200 bg-white shadow-soft overflow-hidden">
      <div className="report-print-title">
        <h1 className="text-xl font-bold">{t('reports.title')} — {t(activeReport === 'balance' ? 'reports.stockBalance' : activeReport === 'movement' ? 'reports.stockMovement' : 'reports.salesReport')}</h1>
      </div>
      {/* Summary KPI Cards if applicable */}
      {activeReport === 'balance' && (summary?.totalValuation !== undefined || summary?.stockValue !== undefined) && user?.role !== 'STAFF' && (
        <div className="rounded-2xl border border-slate-200 bg-linear-to-r from-blue-900 to-indigo-900 p-6 text-white shadow-soft flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-wider text-blue-200 font-bold">{t('reports.totalValue')}</p>
            <p className="text-3xl font-extrabold mt-1">{formatETB(summary.totalValuation ?? summary.stockValue, i18n.language)}</p>
          </div>
          <Boxes className="h-12 w-12 text-blue-300 opacity-60" />
        </div>
      )}

      {activeReport === 'sales' && (summary?.totalSales !== undefined || summary?.total !== undefined) && (
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-soft">
            <span className="text-xs text-slate-500 font-bold uppercase">{t('reports.totalRevenue')}</span>
            <p className="text-xl font-extrabold text-slate-900 mt-1">{formatETB(summary.totalSales ?? summary.total, i18n.language)}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-soft">
            <span className="text-xs text-slate-500 font-bold uppercase">{t('reports.taxCollected')}</span>
            <p className="text-xl font-extrabold text-blue-700 mt-1">{formatETB(summary.totalTax ?? summary.tax, i18n.language)}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-soft">
            <span className="text-xs text-slate-500 font-bold uppercase">{t('reports.invoiceCount')}</span>
            <p className="text-xl font-extrabold text-emerald-700 mt-1">{summary.invoiceCount}</p>
          </div>
        </div>
      )}

      {loading && <div className="px-4 py-10 text-center text-sm text-slate-500">{t('common.loading')}</div>}
      {!loading && loadError && (
        <div role="alert" className="px-4 py-10 text-center text-sm text-red-700">
          {t('reports.loadError')} <button type="button" onClick={() => setReloadKey((key) => key + 1)} className="ml-2 font-bold underline">{t('common.retry')}</button>
        </div>
      )}
      {!loading && !loadError && data.length === 0 && (
        <div className="px-4 py-10 text-center text-sm text-slate-500">{t('reports.noResults')}</div>
      )}
      {!loading && !loadError && data.length > 0 && (
      <>
      <div className="rounded-2xl border border-slate-200 bg-white shadow-soft overflow-hidden">
        <div className="overflow-x-auto">
          {activeReport === 'balance' && (
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase text-[11px] font-bold">
                <tr>
                  <th className="py-3 px-4">{t('products.name')}</th>
                  <th className="py-3 px-4">{t('products.sku')}</th>
                  <th className="py-3 px-4">{t('adjustments.branch')}</th>
                  <th className="py-3 px-4 text-center">{t('products.quantity')}</th>
                  {user?.role !== 'STAFF' && (
                    <th className="py-3 px-4 text-right">{t('products.costPrice')}</th>
                  )}
                  <th className="py-3 px-4 text-right">{t('products.sellingPrice')}</th>
                  {user?.role !== 'STAFF' && (
                    <th className="py-3 px-4 text-right">{t('reports.totalValue')}</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                {data.map((d, i) => (
                  <tr key={i} className="hover:bg-slate-50/70">
                    <td className="py-3 px-4 font-bold text-slate-900">{d.name}</td>
                    <td className="py-3 px-4 font-mono text-slate-600 text-[11px]">{d.sku}</td>
                    <td className="py-3 px-4">{d.branchName}</td>
                    <td className="py-3 px-4 text-center font-bold">{d.quantity} {d.unit}</td>
                    {user?.role !== 'STAFF' && (
                      <td className="py-3 px-4 text-right text-slate-600">{formatETB(d.costPrice, i18n.language)}</td>
                    )}
                    <td className="py-3 px-4 text-right font-semibold text-slate-800">{formatETB(d.sellingPrice, i18n.language)}</td>
                    {user?.role !== 'STAFF' && (
                      <td className="py-3 px-4 text-right font-extrabold text-blue-900">{formatETB(d.valuation, i18n.language)}</td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {activeReport === 'movement' && (
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase text-[11px] font-bold">
                <tr>
                  <th className="py-3 px-4">{t('sales.date')}</th>
                  <th className="py-3 px-4">{t('adjustments.branch')}</th>
                  <th className="py-3 px-4">{t('adjustments.product')}</th>
                  <th className="py-3 px-4">{t('reports.csv.movement.type')}</th>
                  <th className="py-3 px-4 text-center">{t('adjustments.change')}</th>
                  <th className="py-3 px-4 text-center">{t('reports.csv.movement.quantityAfter')}</th>
                  <th className="py-3 px-4">{t('reports.csv.movement.reference')}</th>
                  <th className="py-3 px-4">{t('reports.csv.movement.user')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                {data.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-50/70">
                    <td className="py-3 px-4 text-slate-500">{formatDate(m.date, i18n.language)}</td>
                    <td className="py-3 px-4">{m.branchName}</td>
                    <td className="py-3 px-4 font-bold text-slate-900">{m.productName}</td>
                    <td className="py-3 px-4">
                      <span className="rounded-lg bg-slate-100 px-2 py-0.5 font-bold text-[10px] text-slate-700">
                        {t(`reports.movementTypes.${m.type}`, { defaultValue: m.type })}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center font-extrabold">
                      <span className={m.quantityChange > 0 ? 'text-emerald-700' : 'text-red-600'}>
                        {m.quantityChange > 0 ? `+${m.quantityChange}` : m.quantityChange}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center font-bold text-slate-800">{m.quantityAfter}</td>
                    <td className="py-3 px-4 text-slate-500 font-mono text-[11px]">{m.reason ? t(`reasons.${m.reason}`, { defaultValue: m.reason }) : m.reference || '—'}</td>
                    <td className="py-3 px-4 text-slate-600">{m.user}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {activeReport === 'sales' && (
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase text-[11px] font-bold">
                <tr>
                  <th className="py-3 px-4">{t('sales.invoiceNo')}</th>
                  <th className="py-3 px-4">{t('sales.date')}</th>
                  <th className="py-3 px-4">{t('reports.csv.sales.branch')}</th>
                  <th className="py-3 px-4">{t('reports.csv.sales.cashier')}</th>
                  <th className="py-3 px-4 text-right">{t('reports.netAmount')}</th>
                  <th className="py-3 px-4 text-right">{t('sales.tax')}</th>
                  <th className="py-3 px-4 text-right">{t('sales.total')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                {data.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/70">
                    <td className="py-3 px-4 font-mono font-bold text-blue-700">{s.invoiceNumber}</td>
                    <td className="py-3 px-4 text-slate-500">{formatDate(s.createdAt, i18n.language)}</td>
                    <td className="py-3 px-4">{s.branchName}</td>
                    <td className="py-3 px-4">{s.cashier || s.createdBy?.name || s.createdByName || s.user || '—'}</td>
                    <td className="py-3 px-4 text-right text-slate-600">{formatETB(s.net ?? s.netAmount ?? s.subtotal, i18n.language)}</td>
                    <td className="py-3 px-4 text-right text-slate-600">{formatETB(s.tax ?? s.taxAmount, i18n.language)}</td>
                    <td className="py-3 px-4 text-right font-extrabold text-emerald-800">{formatETB(s.total, i18n.language)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
      {!loading && !loadError && currentResult?.total > PAGE_SIZE && (
        <div className="no-print flex items-center justify-between border-t border-slate-200 px-4 py-3 text-sm text-slate-600">
          <span>{t('reports.pageSummary', { page, pageCount: Math.ceil(currentResult.total / (currentResult.limit || PAGE_SIZE)), total: currentResult.total })}</span>
          <div className="flex gap-2">
            <button type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)} className="rounded-lg border border-slate-300 px-3 py-1.5 font-semibold disabled:opacity-40">{t('common.previous')}</button>
            <button type="button" disabled={page >= Math.ceil(currentResult.total / (currentResult.limit || PAGE_SIZE))} onClick={() => setPage((value) => value + 1)} className="rounded-lg border border-slate-300 px-3 py-1.5 font-semibold disabled:opacity-40">{t('common.next')}</button>
          </div>
        </div>
      )}
      </>
      )}
      </div>
    </div>
  )
}
