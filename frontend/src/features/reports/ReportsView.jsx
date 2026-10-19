import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../auth/AuthContext'
import { api } from '../../lib/api'
import { useFormatBirr } from '../../lib/money'
import { useFormatDate } from '../../lib/dateFormat'
import {
  BarChart3,
  Download,
  Printer,
  Calendar,
  Building2,
  Boxes,
  TrendingUp,
  FileSpreadsheet,
  ArrowRightLeft
} from 'lucide-react'

export default function ReportsView() {
  const { user, selectedBranchId } = useAuth()
  const { t, i18n } = useTranslation()
  const isAm = i18n.language === 'am'
  const formatMoney = useFormatBirr()
  const formatDate = useFormatDate()

  const [activeReport, setActiveReport] = useState('balance') // 'balance', 'movement', 'sales'
  const [data, setData] = useState([])
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadReport()
  }, [activeReport, selectedBranchId])

  const loadReport = () => {
    setLoading(true)
    let endpoint = '/reports/stock'
    if (activeReport === 'movement') endpoint = '/reports/movements'
    if (activeReport === 'sales') endpoint = '/reports/sales'

    api.get(endpoint, { branchId: selectedBranchId, limit: 100 })
      .then((res) => {
        setData(res.data || [])
        setSummary(activeReport === 'balance' ? { totalValuation: res.totals?.stockValue }
          : activeReport === 'sales' ? { totalSales: res.totals?.total, totalTax: res.totals?.taxAmount, invoiceCount: res.total }
            : null)
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false))
  }

  // Feature 17: CSV Export with UTF-8 BOM for Excel Amharic support
  const exportToCsv = async () => {
    if (!data.length) return
    const endpoint = activeReport === 'balance' ? '/reports/stock' : activeReport === 'movement' ? '/reports/movements' : '/reports/sales'
    try {
      const blob = await api.download(endpoint, { branchId: selectedBranchId, format: 'csv' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `berhan_${activeReport}_report.csv`
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error(err)
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
            {isAm
              ? 'የክምችት ሚዛን፣ የእንቅስቃሴ ካርዴክስ እና የሽያጭ ሪፖርቶች'
              : 'Detailed inventory valuation, stock cardex movements, and sales performance'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={exportToCsv}
            disabled={data.length === 0}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50 transition disabled:opacity-50"
          >
            <Download className="h-4 w-4 text-blue-600" />
            {t('reports.exportCsv')}
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

      {/* Report Tabs */}
      <div className="flex rounded-2xl bg-slate-200/60 p-1.5 text-xs font-bold gap-1 no-print">
        <button
          onClick={() => setActiveReport('balance')}
          className={`flex-1 py-2 rounded-xl transition text-center ${
            activeReport === 'balance'
              ? 'bg-white text-blue-800 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          {t('reports.stockBalance')}
        </button>
        <button
          onClick={() => setActiveReport('movement')}
          className={`flex-1 py-2 rounded-xl transition text-center ${
            activeReport === 'movement'
              ? 'bg-white text-blue-800 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          {t('reports.stockMovement')}
        </button>
        <button
          onClick={() => setActiveReport('sales')}
          className={`flex-1 py-2 rounded-xl transition text-center ${
            activeReport === 'sales'
              ? 'bg-white text-blue-800 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          {t('reports.salesReport')}
        </button>
      </div>

      {/* Summary KPI Cards if applicable */}
      {activeReport === 'balance' && summary?.totalValuation !== undefined && user?.role !== 'STAFF' && (
        <div className="rounded-2xl border border-slate-200 bg-linear-to-r from-blue-900 to-indigo-900 p-6 text-white shadow-soft flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-wider text-blue-200 font-bold">{t('reports.totalValue')}</p>
            <p className="text-3xl font-extrabold mt-1">{formatMoney(summary.totalValuation)}</p>
          </div>
          <Boxes className="h-12 w-12 text-blue-300 opacity-60" />
        </div>
      )}

      {activeReport === 'sales' && summary?.totalSales !== undefined && (
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-soft">
            <span className="text-xs text-slate-500 font-bold uppercase">{isAm ? 'ጠቅላላ ሽያጭ' : 'Total Revenue'}</span>
            <p className="text-xl font-extrabold text-slate-900 mt-1">{formatMoney(summary.totalSales)}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-soft">
            <span className="text-xs text-slate-500 font-bold uppercase">{isAm ? 'የተሰበሰበ ግብር (VAT)' : 'Tax Collected'}</span>
            <p className="text-xl font-extrabold text-blue-700 mt-1">{formatMoney(summary.totalTax)}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-soft">
            <span className="text-xs text-slate-500 font-bold uppercase">{isAm ? 'የደረሰኞች ብዛት' : 'Invoices Count'}</span>
            <p className="text-xl font-extrabold text-emerald-700 mt-1">{summary.invoiceCount}</p>
          </div>
        </div>
      )}

      {/* Report Data Table */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-soft overflow-hidden printable-area">
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
                    <th className="py-3 px-4 text-right">{isAm ? 'ጠቅላላ ዋጋ' : 'Total Valuation'}</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                {data.map((d, i) => (
                  <tr key={i} className="hover:bg-slate-50/70">
                    <td className="py-3 px-4 font-bold text-slate-900">{d.productName}</td>
                    <td className="py-3 px-4 font-mono text-slate-600 text-[11px]">{d.sku}</td>
                    <td className="py-3 px-4">{d.branchName}</td>
                    <td className="py-3 px-4 text-center font-bold">{d.quantity} {d.unit}</td>
                    {user?.role !== 'STAFF' && (
                      <td className="py-3 px-4 text-right text-slate-600">{formatMoney(d.costPrice)}</td>
                    )}
                    <td className="py-3 px-4 text-right font-semibold text-slate-800">{formatMoney(d.sellingPrice)}</td>
                    {user?.role !== 'STAFF' && (
                      <td className="py-3 px-4 text-right font-extrabold text-blue-900">{formatMoney(d.stockValue)}</td>
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
                  <th className="py-3 px-4">{isAm ? 'የእንቅስቃሴ ዓይነት' : 'Movement Type'}</th>
                  <th className="py-3 px-4 text-center">{t('adjustments.change')}</th>
                  <th className="py-3 px-4 text-center">{isAm ? 'ቀሪ ብዛት' : 'Qty After'}</th>
                  <th className="py-3 px-4">{isAm ? 'ምክንያት / ማጣቀሻ' : 'Reference / Reason'}</th>
                  <th className="py-3 px-4">{isAm ? 'ተጠቃሚ' : 'User'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                {data.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-50/70">
                    <td className="py-3 px-4 text-slate-500">{formatDate(m.createdAt, i18n.language)}</td>
                    <td className="py-3 px-4">{m.branchName}</td>
                    <td className="py-3 px-4 font-bold text-slate-900">{m.productName}</td>
                    <td className="py-3 px-4">
                      <span className="rounded-lg bg-slate-100 px-2 py-0.5 font-bold text-[10px] text-slate-700">
                        {m.type}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center font-extrabold">
                      <span className={m.quantityChange > 0 ? 'text-emerald-700' : 'text-red-600'}>
                        {m.quantityChange > 0 ? `+${m.quantityChange}` : m.quantityChange}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center font-bold text-slate-800">{m.quantityAfter}</td>
                    <td className="py-3 px-4 text-slate-500 font-mono text-[11px]">{m.reason}</td>
                    <td className="py-3 px-4 text-slate-600">{m.createdBy?.name}</td>
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
                  <th className="py-3 px-4">{isAm ? 'ቅርንጫፍ' : 'Branch'}</th>
                  <th className="py-3 px-4">{isAm ? 'ደንበኛ' : 'Customer'}</th>
                  <th className="py-3 px-4 text-right">{t('sales.subtotal')}</th>
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
                    <td className="py-3 px-4">{s.customerName}</td>
                    <td className="py-3 px-4 text-right text-slate-600">{formatMoney(s.netAmount)}</td>
                    <td className="py-3 px-4 text-right text-slate-600">{formatMoney(s.taxAmount)}</td>
                    <td className="py-3 px-4 text-right font-extrabold text-emerald-800">{formatMoney(s.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
