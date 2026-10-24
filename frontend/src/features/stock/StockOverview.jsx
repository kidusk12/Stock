import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Archive, Clock3, Search, SlidersHorizontal, X } from 'lucide-react'
import { useAuth } from '../auth/AuthContext'
import { api } from '../../lib/api'
import { formatDate, formatETB } from '../../lib/ethiopianDate'

const LIMIT = 20

export default function StockOverview() {
  const { user, selectedBranchId } = useAuth()
  const { t, i18n } = useTranslation()
  const [tab, setTab] = useState('levels')
  const [rows, setRows] = useState([])
  const [movements, setMovements] = useState([])
  const [categories, setCategories] = useState([])
  const [products, setProducts] = useState([])
  const [query, setQuery] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [lowOnly, setLowOnly] = useState(false)
  const [consolidated, setConsolidated] = useState(false)
  const [productId, setProductId] = useState('')
  const [movementType, setMovementType] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [pageCount, setPageCount] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(null)
  const [minQuantity, setMinQuantity] = useState('')
  const [maxQuantity, setMaxQuantity] = useState('')
  const [saving, setSaving] = useState(false)

  const canSetThreshold = ['ADMIN', 'BRANCH_MANAGER'].includes(user?.role)
  const isConsolidated = consolidated && !selectedBranchId

  const loadStock = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const result = await api.get(isConsolidated ? '/stock/consolidated' : '/stock', {
        branchId: selectedBranchId || undefined,
        categoryId: categoryId || undefined,
        q: query.trim() || undefined,
        lowOnly: !isConsolidated && lowOnly ? true : undefined,
        page,
        limit: LIMIT,
      })
      setRows(result.data || [])
      setTotal(result.total ?? result.data?.length ?? 0)
      setPageCount(Math.max(1, Math.ceil((result.total ?? 0) / (result.limit || LIMIT))))
    } catch (err) {
      setError(t(`errors.${err.code}`, { defaultValue: t('stock.loadError') }))
    } finally {
      setLoading(false)
    }
  }, [categoryId, isConsolidated, lowOnly, page, query, selectedBranchId, t])

  const loadMovements = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const result = await api.get('/stock-movements', {
        branchId: selectedBranchId || undefined,
        productId: productId || undefined,
        type: movementType || undefined,
        from: fromDate || undefined,
        to: toDate || undefined,
        page,
        limit: LIMIT,
      })
      setMovements(result.data || [])
      setTotal(result.total ?? result.data?.length ?? 0)
      setPageCount(Math.max(1, Math.ceil((result.total ?? 0) / (result.limit || LIMIT))))
    } catch (err) {
      setError(t(`errors.${err.code}`, { defaultValue: t('stock.movementsError') }))
    } finally {
      setLoading(false)
    }
  }, [fromDate, movementType, page, productId, selectedBranchId, t, toDate])

  useEffect(() => {
    api.get('/categories').then((result) => setCategories(result.data || [])).catch(() => {})
    let cancelled = false
    const loadAllProducts = async () => {
      try {
        const firstPage = await api.get('/products', { page: 1, limit: 100 })
        const pageCount = Math.ceil((firstPage.total || 0) / (firstPage.limit || 100))
        const remainingPages = await Promise.all(Array.from({ length: Math.max(0, pageCount - 1) }, (_, index) =>
          api.get('/products', { page: index + 2, limit: 100 })
        ))
        if (!cancelled) setProducts([...(firstPage.data || []), ...remainingPages.flatMap((result) => result.data || [])])
      } catch {
        if (!cancelled) setProducts([])
      }
    }
    void loadAllProducts()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    // Start the API request from the effect; loadStock/loadMovements update state when the request settles.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (tab === 'levels') void loadStock()
    else void loadMovements()
  }, [tab, loadStock, loadMovements])

  const openThresholdEditor = (row) => {
    setEditing(row)
    setMinQuantity(String(row.minQuantity ?? 0))
    setMaxQuantity(row.maxQuantity == null ? '' : String(row.maxQuantity))
    setError('')
  }

  const saveThreshold = async (event) => {
    event.preventDefault()
    if (!editing) return
    setSaving(true)
    setError('')
    try {
      await api.put(`/stock/${editing.branchId}/${editing.productId}/thresholds`, {
        minQuantity: Number(minQuantity),
        maxQuantity: maxQuantity.trim() === '' ? null : Number(maxQuantity),
      })
      setEditing(null)
      await loadStock()
    } catch (err) {
      setError(t(`errors.${err.code}`, { defaultValue: t('stock.thresholdError') }))
    } finally {
      setSaving(false)
    }
  }

  const resetFilters = (setter) => (event) => {
    setter(event.target.value)
    setPage(1)
  }

  const movementDate = (movement) => movement.createdAt || movement.date
  const movementUser = (movement) => movement.createdBy?.name || movement.user || t('common.noData')

  return (
    <div className="space-y-6">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight text-slate-900">
          <Archive className="h-6 w-6 text-teal-700" aria-hidden="true" />{t('stock.title')}
        </h1>
        <p className="mt-1 text-sm text-slate-500">{t('stock.description')}</p>
      </header>

      <div className="flex gap-1 rounded-xl bg-slate-200/70 p-1" role="tablist" aria-label={t('stock.title')}>
        <button type="button" role="tab" aria-selected={tab === 'levels'} onClick={() => { setTab('levels'); setPage(1) }} className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold ${tab === 'levels' ? 'bg-white text-teal-800 shadow-sm' : 'text-slate-600'}`}>
          <Archive className="h-4 w-4" aria-hidden="true" />{t('stock.levels')}
        </button>
        <button type="button" role="tab" aria-selected={tab === 'movements'} onClick={() => { setTab('movements'); setPage(1) }} className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold ${tab === 'movements' ? 'bg-white text-teal-800 shadow-sm' : 'text-slate-600'}`}>
          <Clock3 className="h-4 w-4" aria-hidden="true" />{t('stock.movements')}
        </button>
      </div>

      <section className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row sm:flex-wrap sm:items-center">
        {tab === 'levels' ? <label className="relative min-w-0 flex-1">
          <span className="sr-only">{t('stock.search')}</span>
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" aria-hidden="true" />
          <input type="search" value={query} onChange={resetFilters(setQuery)} placeholder={t('stock.search')} className="w-full rounded-xl border border-slate-300 py-2 pl-9 pr-3 text-sm focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-100" />
        </label> : <>
          <label><span className="sr-only">{t('stock.product')}</span><select value={productId} onChange={resetFilters(setProductId)} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm sm:w-60"><option value="">{t('stock.allProducts')}</option>{products.map((product) => <option key={product.id} value={product.id}>{product.name} · {product.sku}</option>)}</select></label>
          <label><span className="sr-only">{t('stock.type')}</span><select value={movementType} onChange={resetFilters(setMovementType)} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm sm:w-52"><option value="">{t('stock.allTypes')}</option>{['OPENING_STOCK', 'PURCHASE_RECEIPT', 'SALE', 'CUSTOMER_RETURN', 'ADJUSTMENT', 'TRANSFER_OUT', 'TRANSFER_IN'].map((type) => <option key={type} value={type}>{t(`status.${type}`, { defaultValue: type })}</option>)}</select></label>
          <label className="min-w-36 flex-1"><span className="sr-only">{t('stock.from')}</span><input type="date" aria-label={t('stock.from')} value={fromDate} max={toDate || undefined} onChange={resetFilters(setFromDate)} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm" /></label>
          <label className="min-w-36 flex-1"><span className="sr-only">{t('stock.to')}</span><input type="date" aria-label={t('stock.to')} value={toDate} min={fromDate || undefined} onChange={resetFilters(setToDate)} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm" /></label>
        </>}
        {tab === 'levels' && <>
          <label><span className="sr-only">{t('stock.category')}</span><select value={categoryId} onChange={resetFilters(setCategoryId)} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm sm:w-52"><option value="">{t('stock.allCategories')}</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
          {!isConsolidated && <label className="flex shrink-0 items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={lowOnly} onChange={(event) => { setLowOnly(event.target.checked); setPage(1) }} className="rounded border-slate-300 text-teal-700 focus:ring-teal-600" />{t('stock.lowOnly')}</label>}
          {['ADMIN', 'AUDITOR'].includes(user?.role) && !selectedBranchId && <label className="flex shrink-0 items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={consolidated} onChange={(event) => { setConsolidated(event.target.checked); setLowOnly(false); setPage(1) }} className="rounded border-slate-300 text-teal-700 focus:ring-teal-600" />{t('stock.consolidated')}</label>}
        </>}
      </section>

      {error && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800" role="alert">{error}</div>}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-soft">
        <div className="overflow-x-auto">
          {tab === 'levels' ? <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase tracking-wide text-slate-600"><tr>
              <th className="px-4 py-3">{t('products.name')}</th><th className="px-4 py-3">{t('products.sku')}</th>{!isConsolidated && <><th className="px-4 py-3">{t('stock.category')}</th><th className="px-4 py-3">{t('stock.branch')}</th></>}<th className="px-4 py-3 text-right">{isConsolidated ? t('stock.totalQuantity') : t('stock.quantity')}</th>{!isConsolidated && <><th className="px-4 py-3 text-right">{t('stock.minimum')}</th><th className="px-4 py-3 text-right">{t('stock.maximum')}</th></>}{isConsolidated ? <th className="px-4 py-3">{t('stock.branchBreakdown')}</th> : user?.role !== 'STAFF' && <th className="px-4 py-3 text-right">{t('stock.value')}</th>}{!isConsolidated && canSetThreshold && <th className="px-4 py-3 text-right">{t('common.actions')}</th>}
            </tr></thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {loading ? <tr><td colSpan={isConsolidated ? 4 : canSetThreshold ? 9 : user?.role === 'STAFF' ? 7 : 8} className="py-12 text-center text-slate-500" role="status">{t('common.loading')}</td></tr>
                : rows.length === 0 ? <tr><td colSpan={isConsolidated ? 4 : canSetThreshold ? 9 : user?.role === 'STAFF' ? 7 : 8} className="py-12 text-center text-slate-500">{t('stock.empty')}</td></tr>
                  : rows.map((row) => {
                    const low = row.minQuantity > 0 && row.quantity <= row.minQuantity
                    return <tr key={isConsolidated ? row.productId : `${row.branchId}-${row.productId}`} className="hover:bg-slate-50/70">
                      <td className="px-4 py-3 font-semibold text-slate-900">{row.productName}</td><td className="px-4 py-3 font-mono text-xs">{row.sku}</td>{!isConsolidated && <><td className="px-4 py-3">{row.categoryName}</td><td className="px-4 py-3">{row.branchName}</td></>}<td className="px-4 py-3 text-right font-bold"><span className={low ? 'text-red-700' : ''}>{isConsolidated ? row.totalQuantity : row.quantity}</span></td>{!isConsolidated && <><td className="px-4 py-3 text-right">{row.minQuantity}</td><td className="px-4 py-3 text-right">{row.maxQuantity ?? t('stock.notSet')}</td></>}{isConsolidated ? <td className="px-4 py-3">{(row.branches || []).map((branch) => `${branch.branchName}: ${branch.quantity}`).join(' · ')}</td> : user?.role !== 'STAFF' && <td className="px-4 py-3 text-right">{row.stockValue == null ? t('stock.notAvailable') : formatETB(row.stockValue, i18n.language)}</td>}{!isConsolidated && canSetThreshold && <td className="px-4 py-3 text-right"><button type="button" onClick={() => openThresholdEditor(row)} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 font-semibold text-teal-800 hover:bg-teal-50"><SlidersHorizontal className="h-4 w-4" aria-hidden="true" />{t('stock.setThreshold')}</button></td>}
                    </tr>
                  })}
            </tbody>
          </table> : <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase tracking-wide text-slate-600"><tr><th className="px-4 py-3">{t('stock.date')}</th><th className="px-4 py-3">{t('stock.branch')}</th><th className="px-4 py-3">{t('products.name')}</th><th className="px-4 py-3">{t('stock.type')}</th><th className="px-4 py-3 text-right">{t('stock.change')}</th><th className="px-4 py-3 text-right">{t('stock.quantityAfter')}</th><th className="px-4 py-3">{t('stock.referenceReason')}</th><th className="px-4 py-3">{t('stock.user')}</th></tr></thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">{loading ? <tr><td colSpan="8" className="py-12 text-center text-slate-500" role="status">{t('common.loading')}</td></tr> : movements.length === 0 ? <tr><td colSpan="8" className="py-12 text-center text-slate-500">{t('stock.emptyMovements')}</td></tr> : movements.map((movement) => <tr key={movement.id} className="hover:bg-slate-50/70"><td className="whitespace-nowrap px-4 py-3">{formatDate(movementDate(movement), i18n.language)}</td><td className="px-4 py-3">{movement.branchName}</td><td className="px-4 py-3 font-semibold text-slate-900">{movement.productName}</td><td className="px-4 py-3">{t(`status.${movement.type}`, { defaultValue: movement.type })}</td><td className={`px-4 py-3 text-right font-bold ${movement.quantityChange > 0 ? 'text-emerald-700' : 'text-red-700'}`}>{movement.quantityChange > 0 ? '+' : ''}{movement.quantityChange}</td><td className="px-4 py-3 text-right font-semibold">{movement.quantityAfter}</td><td className="px-4 py-3">{movement.reason || movement.referenceType || t('stock.notSet')}</td><td className="px-4 py-3">{movementUser(movement)}</td></tr>)}</tbody>
          </table>}
        </div>
      </div>

      {!loading && pageCount > 1 && <div className="flex items-center justify-between text-sm text-slate-600"><span>{t('stock.pageSummary', { page, pageCount, total })}</span><div className="flex gap-2"><button type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)} className="rounded-lg border border-slate-300 px-3 py-1.5 font-semibold disabled:opacity-40">{t('common.previous')}</button><button type="button" disabled={page >= pageCount} onClick={() => setPage((value) => value + 1)} className="rounded-lg border border-slate-300 px-3 py-1.5 font-semibold disabled:opacity-40">{t('common.next')}</button></div></div>}

      {editing && <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setEditing(null) }}>
        <section role="dialog" aria-modal="true" aria-labelledby="stock-threshold-title" className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
          <div className="flex items-start justify-between gap-3"><div><h2 id="stock-threshold-title" className="text-lg font-extrabold text-slate-900">{t('stock.setThreshold')}</h2><p className="mt-1 text-sm text-slate-600">{editing.productName} · {editing.branchName}</p></div><button type="button" disabled={saving} onClick={() => setEditing(null)} aria-label={t('common.close')} className="rounded-lg p-1 text-slate-500 hover:bg-slate-100 disabled:opacity-40"><X className="h-5 w-5" aria-hidden="true" /></button></div>
          <form className="mt-5 space-y-4" onSubmit={saveThreshold}>
            <label className="block text-sm font-semibold text-slate-700">{t('stock.minimum')}<input type="number" min="0" step="0.01" required value={minQuantity} onChange={(event) => setMinQuantity(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-100" /></label>
            <label className="block text-sm font-semibold text-slate-700">{t('stock.maximum')}<input type="number" min={minQuantity || 0} step="0.01" value={maxQuantity} onChange={(event) => setMaxQuantity(event.target.value)} placeholder={t('stock.optional')} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-100" /></label>
            {error && <div role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</div>}
            <div className="flex justify-end gap-2 border-t border-slate-100 pt-4"><button type="button" disabled={saving} onClick={() => setEditing(null)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold">{t('common.cancel')}</button><button type="submit" disabled={saving} className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-bold text-white hover:bg-teal-800 disabled:opacity-50">{saving ? t('common.loading') : t('common.save')}</button></div>
          </form>
        </section>
      </div>}
    </div>
  )
}
