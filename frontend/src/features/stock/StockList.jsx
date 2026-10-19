import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../auth/AuthContext'
import { api } from '../../lib/api'

export default function StockList() {
  const { user, selectedBranchId } = useAuth()
  const { t } = useTranslation()
  const [rows, setRows] = useState([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    setLoading(true)
    api.get('/stock', { branchId: selectedBranchId, limit: 100 })
      .then((result) => { if (active) setRows(result.data || []) })
      .catch((err) => { if (active) setError(err.message || t('errors.SERVER_ERROR')) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [selectedBranchId, t])

  const filtered = rows.filter((row) => [row.productName, row.sku, row.branchName]
    .some((value) => String(value || '').toLowerCase().includes(query.toLowerCase())))

  return <section className="space-y-5">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div><h1 className="text-2xl font-bold">{t('nav.stock', 'Stock overview')}</h1><p className="text-sm text-slate-500">{t('stock.description', 'Current quantities by product and branch')}</p></div>
      <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('common.search')} className="rounded-lg border bg-white px-3 py-2 text-sm" />
    </div>
    {error && <p role="alert" className="rounded border border-red-200 bg-red-50 p-3 text-red-700">{error}</p>}
    <div className="overflow-x-auto rounded-xl border bg-white">
      <table className="w-full text-left text-sm">
        <thead className="border-b bg-slate-50 text-xs uppercase text-slate-500"><tr>
          <th className="p-3">{t('products.name')}</th><th className="p-3">{t('products.sku')}</th>
          <th className="p-3">{t('adjustments.branch')}</th><th className="p-3 text-right">{t('products.quantity')}</th>
          <th className="p-3 text-right">{t('products.minQuantity')}</th>
          {user?.role !== 'STAFF' && <th className="p-3 text-right">{t('products.costPrice')}</th>}
          {user?.role !== 'STAFF' && <th className="p-3 text-right">{t('products.stockValue')}</th>}
        </tr></thead>
        <tbody className="divide-y">
          {loading ? <tr><td colSpan={user?.role === 'STAFF' ? 5 : 7} className="p-8 text-center text-slate-500">{t('common.loading')}</td></tr>
            : filtered.length === 0 ? <tr><td colSpan={user?.role === 'STAFF' ? 5 : 7} className="p-8 text-center text-slate-500">{t('common.noData')}</td></tr>
              : filtered.map((row) => <tr key={`${row.branchId}-${row.productId}`}>
                <td className="p-3 font-medium">{row.productName}</td><td className="p-3 font-mono text-xs">{row.sku}</td>
                <td className="p-3">{row.branchName}</td><td className="p-3 text-right">{row.quantity}</td>
                <td className="p-3 text-right">{row.minQuantity > 0 ? row.minQuantity : '—'}</td>
                {user?.role !== 'STAFF' && <td className="p-3 text-right">{row.costPrice?.toFixed(2)}</td>}
                {user?.role !== 'STAFF' && <td className="p-3 text-right">{row.stockValue?.toFixed(2)}</td>}
              </tr>)}
        </tbody>
      </table>
    </div>
  </section>
}
