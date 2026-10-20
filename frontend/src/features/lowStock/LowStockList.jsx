import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../auth/AuthContext'
import { api } from '../../lib/api'
import { AlertTriangle, CheckCircle2, ShoppingCart } from 'lucide-react'

const LIMIT = 20

export default function LowStockList() {
  const { user, selectedBranchId } = useAuth()
  const { t } = useTranslation()
  const [lowStockItems, setLowStockItems] = useState([])
  const [categories, setCategories] = useState([])
  const [categoryId, setCategoryId] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [pageCount, setPageCount] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadLowStock = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const result = await api.get('/low-stock', {
        branchId: user?.role === 'ADMIN' ? selectedBranchId || undefined : undefined,
        categoryId: categoryId || undefined,
        page,
        limit: LIMIT,
      })
      setLowStockItems(result.data || [])
      setTotal(result.total ?? result.data?.length ?? 0)
      setPageCount(Math.max(1, Math.ceil((result.total ?? 0) / (result.limit || LIMIT))))
    } catch (err) {
      setError(t(`errors.${err.code}`, { defaultValue: t('lowStock.loadError') }))
    } finally {
      setLoading(false)
    }
  }, [categoryId, page, selectedBranchId, t, user?.role])

  useEffect(() => {
    api.get('/categories').then((result) => setCategories(result.data || [])).catch(() => {})
  }, [])

  useEffect(() => { void loadLowStock() }, [loadLowStock])

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="flex items-center gap-2.5 text-2xl font-extrabold tracking-tight text-slate-900">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-amber-100 text-amber-700"><AlertTriangle className="h-5 w-5" aria-hidden="true" /></span>
            {t('lowStock.title')}
          </h1>
          <p className="mt-1 text-sm text-slate-500">{t('lowStock.description')}</p>
        </div>
        <Link to="/purchases" className="inline-flex items-center gap-1.5 rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-teal-800"><ShoppingCart className="h-4 w-4" aria-hidden="true" />{t('lowStock.createPo')}</Link>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-600">{user?.role === 'ADMIN' && !selectedBranchId ? t('common.allBranches') : user?.branchName || ''}</p>
        <label className="text-sm font-semibold text-slate-700"><span className="sr-only">{t('lowStock.category')}</span><select value={categoryId} onChange={(event) => { setCategoryId(event.target.value); setPage(1) }} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 sm:w-64"><option value="">{t('lowStock.allCategories')}</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
      </div>

      {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}<button type="button" onClick={() => void loadLowStock()} className="ml-2 font-bold underline">{t('common.retry')}</button></div>}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-soft">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase tracking-wide text-slate-600"><tr>
              <th className="px-4 py-3">{t('products.name')}</th><th className="px-4 py-3">{t('products.sku')}</th><th className="px-4 py-3">{t('lowStock.branch')}</th><th className="px-4 py-3 text-right">{t('lowStock.currentStock')}</th><th className="px-4 py-3 text-right">{t('lowStock.minLevel')}</th><th className="px-4 py-3 text-right">{t('lowStock.maxLevel')}</th><th className="px-4 py-3 text-right text-teal-800">{t('lowStock.reorderQty')}</th>
            </tr></thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {loading ? <tr><td colSpan="7" className="py-12 text-center text-slate-500" role="status">{t('common.loading')}</td></tr>
                : lowStockItems.length === 0 ? <tr><td colSpan="7" className="py-12 text-center text-slate-500"><CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-emerald-500" aria-hidden="true" /><span className="font-bold text-slate-700">{t('lowStock.noItems')}</span></td></tr>
                  : lowStockItems.map((item) => <tr key={`${item.branchId}-${item.productId}`} className="hover:bg-slate-50/70">
                    <td className="px-4 py-3 font-semibold text-slate-900">{item.productName}</td><td className="px-4 py-3 font-mono text-xs">{item.sku}</td><td className="px-4 py-3">{item.branchName}</td><td className="px-4 py-3 text-right font-bold text-red-700">{item.quantity}</td><td className="px-4 py-3 text-right">{item.minQuantity}</td><td className="px-4 py-3 text-right">{item.maxQuantity ?? t('lowStock.notSet')}</td><td className="px-4 py-3 text-right font-extrabold text-teal-800">+{item.suggestedReorderQuantity}</td>
                  </tr>)}
            </tbody>
          </table>
        </div>
      </div>

      {!loading && pageCount > 1 && <div className="flex items-center justify-between text-sm text-slate-600"><span>{t('stock.pageSummary', { page, pageCount, total })}</span><div className="flex gap-2"><button type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)} className="rounded-lg border border-slate-300 px-3 py-1.5 font-semibold disabled:opacity-40">{t('common.previous')}</button><button type="button" disabled={page >= pageCount} onClick={() => setPage((value) => value + 1)} className="rounded-lg border border-slate-300 px-3 py-1.5 font-semibold disabled:opacity-40">{t('common.next')}</button></div></div>}
    </div>
  )
}
