import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../auth/AuthContext'
import { api } from '../../lib/api'
import { formatETB } from '../../lib/ethiopianDate'
import {
  Search,
  Plus,
  FileSpreadsheet,
  AlertTriangle,
  Building2,
  Upload,
  Download
} from 'lucide-react'

const UNIT_OPTIONS = [
  'piece',
  'box',
  'carton',
  'pack',
  'bag',
  'bottle',
  'kg',
  'g',
  'liter',
  'meter',
  'roll',
  'can',
  'pair',
  'set',
  'dozen',
  'sheet',
  'bundle',
]

export default function ProductsList() {
  const { user, selectedBranchId } = useAuth()
  const { t, i18n } = useTranslation()
  const isAdmin = user?.role === 'ADMIN'

  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [branches, setBranches] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedCat, setSelectedCat] = useState('')
  const [includeInactive, setIncludeInactive] = useState(false)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [pageCount, setPageCount] = useState(1)
  const [pageError, setPageError] = useState('')

  // Modals
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingProduct, setEditingProduct] = useState(null)
  const [showBranchModal, setShowBranchModal] = useState(null)
  const [showImportModal, setShowImportModal] = useState(false)

  // Add form state
  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    barcode: '',
    categoryId: '1',
    unit: 'piece',
    costPrice: '',
    sellingPrice: '',
  })
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // CSV Import state
  const [importFile, setImportFile] = useState(null)
  const [importBranchId, setImportBranchId] = useState(selectedBranchId ? String(selectedBranchId) : '')
  const [importResult, setImportResult] = useState(null)
  const [importError, setImportError] = useState('')
  const [importBusy, setImportBusy] = useState(false)

  const loadProducts = useCallback(async () => {
    setLoading(true)
    setPageError('')
    try {
      const params = { branchId: selectedBranchId || undefined, q: search || undefined, categoryId: selectedCat || undefined, includeInactive: includeInactive || undefined, page, limit: 20 }
      const [productResult, initialStockResult] = await Promise.all([
        api.get('/products', params),
        api.get('/stock', { branchId: selectedBranchId || undefined, page: 1, limit: 100 }),
      ])
      const stockPages = Math.ceil((initialStockResult.total || 0) / 100)
      const extraStockPages = stockPages > 1 ? await Promise.all(Array.from({ length: stockPages - 1 }, (_, index) =>
        api.get('/stock', { branchId: selectedBranchId || undefined, page: index + 2, limit: 100 })
      )) : []
      const rows = [...(initialStockResult.data || []), ...extraStockPages.flatMap((result) => result.data || [])]
      setTotal(productResult.total ?? productResult.data?.length ?? 0)
      setPageCount(Math.max(1, Math.ceil((productResult.total ?? 0) / (productResult.limit || 20))))
      setProducts((productResult.data || []).map((product) => {
        const productStocks = rows.filter((row) => row.productId === product.id)
        const selectedStock = selectedBranchId ? productStocks.find((row) => row.branchId === Number(selectedBranchId)) : null
        return {
          ...product,
          branchStocks: productStocks,
          quantity: selectedStock?.quantity ?? productStocks.reduce((sum, row) => sum + row.quantity, 0),
          minQuantity: selectedStock?.minQuantity ?? 0,
          isLowStock: selectedStock ? selectedStock.minQuantity > 0 && selectedStock.quantity <= selectedStock.minQuantity
            : productStocks.some((row) => row.minQuantity > 0 && row.quantity <= row.minQuantity),
        }
      }))
    } catch (err) {
      setPageError(t(`errors.${err.code}`, { defaultValue: t('products.loadError') }))
    } finally {
      setLoading(false)
    }
  }, [includeInactive, page, search, selectedBranchId, selectedCat, t])

  useEffect(() => {
    // This effect starts an asynchronous API load; the resulting state updates happen after the request resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadProducts()
  }, [loadProducts])

  useEffect(() => {
    api.get('/categories').then((res) => setCategories(res.data || [])).catch(() => {})
    api.get('/branches').then((res) => setBranches(res.data || [])).catch(() => {})
  }, [])

  const openCreateProduct = () => {
    setEditingProduct(null)
    setFormData({ name: '', sku: '', barcode: '', categoryId: '', unit: '', costPrice: '', sellingPrice: '' })
    setFormError('')
    setShowAddModal(true)
  }

  const openEditProduct = (product) => {
    setEditingProduct(product)
    setFormData({
      name: product.name || '', sku: product.sku || '', barcode: product.barcode || '',
      categoryId: String(product.categoryId || ''), unit: product.unit || '',
      costPrice: String(product.costPrice ?? ''), sellingPrice: String(product.sellingPrice ?? ''),
    })
    setFormError('')
    setShowAddModal(true)
  }

  const handleSaveProduct = async (e) => {
    e.preventDefault()
    setFormError('')
    setSubmitting(true)

    try {
      const payload = {
        ...formData,
        name: formData.name.trim(),
        sku: formData.sku.trim(),
        barcode: formData.barcode.trim() || null,
        categoryId: Number(formData.categoryId),
        unit: formData.unit.trim(),
        costPrice: Number(formData.costPrice),
        sellingPrice: Number(formData.sellingPrice),
      }
      if (editingProduct) await api.patch(`/products/${editingProduct.id}`, payload)
      else await api.post('/products', payload)
      setShowAddModal(false)
      setFormData({ name: '', sku: '', barcode: '', categoryId: '', unit: '', costPrice: '', sellingPrice: '' })
      loadProducts()
    } catch (err) {
      setFormError(t(`errors.${err.code}`, { defaultValue: t('products.saveError') }))
    } finally {
      setSubmitting(false)
    }
  }

  const toggleProductActive = async (product) => {
    setPageError('')
    try {
      await api.patch(`/products/${product.id}`, { isActive: !product.isActive })
      await loadProducts()
    } catch (err) {
      setPageError(t(`errors.${err.code}`, { defaultValue: t('products.statusError') }))
    }
  }

  const handleFileUpload = async (e) => {
    const file = e.target.files[0]
    e.target.value = ''
    if (!file) return
    setImportFile(file)
    setImportResult(null)
    setImportError('')
    setImportBusy(true)
    try {
      const upload = new FormData()
      upload.append('file', file)
      if (importBranchId) upload.append('branchId', importBranchId)
      const result = await api.post('/import/products?dryRun=true', upload)
      setImportResult(result)
    } catch (err) {
      setImportError(err.code === 'VALIDATION_ERROR' && !importBranchId
        ? t('products.selectOpeningBranch')
        : t(`errors.${err.code}`, { defaultValue: t('products.importError') }))
    } finally {
      setImportBusy(false)
    }
  }

  const confirmImport = async () => {
    if (!importFile) return
    setImportBusy(true)
    setImportError('')
    try {
      const upload = new FormData()
      upload.append('file', importFile)
      if (importBranchId) upload.append('branchId', importBranchId)
      const result = await api.post('/import/products?dryRun=false', upload)
      setImportResult(result)
      setImportFile(null)
      await loadProducts()
    } catch (err) {
      setImportError(err.code === 'VALIDATION_ERROR' && !importBranchId
        ? t('products.selectOpeningBranch')
        : t(`errors.${err.code}`, { defaultValue: t('products.importError') }))
    } finally {
      setImportBusy(false)
    }
  }

  const downloadTemplate = async () => {
    try {
      const blob = await api.download('/import/products/template')
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = 'products-import-template.csv'
      anchor.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      setPageError(t(`errors.${err.code}`, { defaultValue: t('products.templateError') }))
    }
  }

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            {t('products.title')}
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            {t('products.description')}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {user?.role === 'ADMIN' && (
            <>
              <button
                onClick={() => { setImportFile(null); setImportResult(null); setImportError(''); setImportBranchId(selectedBranchId ? String(selectedBranchId) : ''); setShowImportModal(true) }}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50 transition"
              >
                <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                {t('products.importCsv')}
              </button>
              <button
                onClick={openCreateProduct}
                className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-blue-700 transition"
              >
                <Plus className="h-4 w-4" />
                {t('products.addProduct')}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-soft flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            placeholder={t('products.scanBarcode')}
            className="w-full rounded-xl border border-slate-200 pl-10 pr-4 py-2 text-xs focus:border-blue-500 focus:outline-none"
          />
        </div>

        <div className="w-full sm:w-56">
          <select
            value={selectedCat}
            onChange={(e) => { setSelectedCat(e.target.value); setPage(1) }}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 focus:border-blue-500 focus:outline-none"
          >
            <option value="">{t('products.allCategories')}</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        {isAdmin && <label className="flex shrink-0 items-center gap-2 text-xs font-semibold text-slate-600">
          <input type="checkbox" checked={includeInactive} onChange={(e) => { setIncludeInactive(e.target.checked); setPage(1) }} className="rounded border-slate-300 text-teal-700 focus:ring-teal-600" />
          {t('products.showInactive')}
        </label>}
      </div>

      {pageError && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800" role="alert">{pageError}</div>}

      {/* Products Table */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-soft overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase tracking-wider text-[11px] font-bold">
              <tr>
                <th className="py-3.5 px-4">{t('products.name')}</th>
                <th className="py-3.5 px-4">{t('products.sku')} / {t('products.barcode')}</th>
                <th className="py-3.5 px-4 whitespace-nowrap">{t('products.category')}</th>
                {user?.role !== 'STAFF' && (
                  <th className="py-3.5 px-4 text-right">{t('products.costPrice')}</th>
                )}
                <th className="py-3.5 px-4 text-right">{t('products.sellingPrice')}</th>
                <th className="py-3.5 px-4 text-center">{t('products.quantity')}</th>
                <th className="py-3.5 px-4 text-center">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
              {loading ? (
                <tr>
                  <td colSpan={user?.role === 'STAFF' ? 6 : 7} className="py-8 text-center text-slate-400" role="status">
                    {t('common.loading')}
                  </td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={user?.role === 'STAFF' ? 6 : 7} className="py-8 text-center text-slate-400">
                    {t('common.noData')}
                  </td>
                </tr>
              ) : (
                products.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/70 transition">
                    <td className="py-3 px-4 font-bold text-slate-900">
                      {p.name}
                      {p.isActive === false && <span className="ml-2 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-800">{t('products.inactive')}</span>}
                      {p.isLowStock && (
                        <span className="ml-2 inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700 border border-amber-200">
                          <AlertTriangle className="h-3 w-3" />
                          {t('products.lowStock')}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-600 font-mono text-[11px]">
                      <div>{p.sku}</div>
                      {p.barcode && <div className="text-slate-400 text-[10px]">{p.barcode}</div>}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="inline-block whitespace-nowrap rounded-lg bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-700">
                        {p.categoryName || '—'}
                      </span>
                    </td>
                    {user?.role !== 'STAFF' && (
                      <td className="py-3 px-4 text-right text-slate-600 font-semibold">
                        {formatETB(p.costPrice, i18n.language)}
                      </td>
                    )}
                    <td className="py-3 px-4 text-right font-bold text-emerald-700">
                      {formatETB(p.sellingPrice, i18n.language)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-extrabold ${
                        p.quantity <= p.minQuantity && p.minQuantity > 0
                          ? 'bg-red-50 text-red-700 border border-red-200'
                          : 'bg-blue-50 text-blue-800'
                      }`}>
                        {p.quantity} {p.unit}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex flex-wrap justify-center gap-2">
                        <button type="button" onClick={() => setShowBranchModal(p)} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-bold text-slate-600 hover:bg-slate-100 transition" aria-label={`${t('products.branchStock')}: ${p.name}`}>
                          <Building2 className="h-3.5 w-3.5 text-teal-700" aria-hidden="true" />{t('products.branchStock')}
                        </button>
                        {isAdmin && <>
                          <button type="button" onClick={() => openEditProduct(p)} className="rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-bold text-teal-800 hover:bg-teal-50">{t('common.edit')}</button>
                          <button type="button" onClick={() => toggleProductActive(p)} className="rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-bold text-slate-600 hover:bg-slate-50">{p.isActive === false ? t('products.activate') : t('products.deactivate')}</button>
                        </>}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {!loading && pageCount > 1 && <div className="flex items-center justify-between text-sm text-slate-600">
        <span>{t('products.pageSummary', { page, pageCount, total })}</span>
        <div className="flex gap-2"><button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded-lg border border-slate-300 px-3 py-1.5 font-semibold disabled:opacity-40">{t('common.previous')}</button>
          <button type="button" disabled={page >= pageCount} onClick={() => setPage((p) => p + 1)} className="rounded-lg border border-slate-300 px-3 py-1.5 font-semibold disabled:opacity-40">{t('common.next')}</button></div>
      </div>}

      {/* Stock Per Branch Modal */}
      {showBranchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="font-extrabold text-base text-slate-900">{showBranchModal.name}</h3>
                <p className="text-xs text-slate-500 font-mono mt-0.5">SKU: {showBranchModal.sku}</p>
              </div>
              <button
                onClick={() => setShowBranchModal(null)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <p className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                {t('products.branchStock')}:
              </p>
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden text-xs">
                {showBranchModal.branchStocks?.map((bs) => (
                  <div key={bs.branchId} className="flex items-center justify-between p-3 hover:bg-slate-50">
                    <div className="font-semibold text-slate-800">{bs.branchName}</div>
                    <div className="flex items-center gap-4">
                      <span className="text-slate-500 text-[11px]">
                        {t('stock.minimum')}: {bs.minQuantity} | {t('stock.maximum')}: {bs.maxQuantity}
                      </span>
                      <span className="font-extrabold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-md">
                        {bs.quantity} {showBranchModal.unit}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setShowBranchModal(null)}
                className="rounded-xl bg-slate-100 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-200"
              >
                {t('common.close')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Product Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-extrabold text-base text-slate-900">{editingProduct ? t('products.editProduct') : t('products.addProduct')}</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600 font-bold">
                ✕
              </button>
            </div>

            {formError && (
              <div className="mt-3 rounded-lg bg-red-50 p-2.5 text-xs font-semibold text-red-700 border border-red-200">
                {formError}
              </div>
            )}

            <form onSubmit={handleSaveProduct} className="mt-4 space-y-3.5 text-xs">
              <div>
                  <label htmlFor="product-name" className="block font-bold text-slate-700 mb-1">{t('products.name')} *</label>
                <input
                    id="product-name"
                  type="text"
                  required
                    maxLength={150}
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder={t('products.exampleName')}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="product-sku" className="block font-bold text-slate-700 mb-1">{t('products.sku')} *</label>
                  <input
                    id="product-sku"
                    type="text"
                    required
                    maxLength={50}
                    value={formData.sku}
                    onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                    placeholder={t('products.exampleSku')}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label htmlFor="product-barcode" className="block font-bold text-slate-700 mb-1">{t('products.barcode')}</label>
                  <input
                    id="product-barcode"
                    type="text"
                    maxLength={50}
                    value={formData.barcode}
                    onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                    placeholder={t('products.exampleBarcode')}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="product-category" className="block font-bold text-slate-700 mb-1">{t('products.category')} *</label>
                  <select
                    id="product-category"
                    required
                    value={formData.categoryId}
                    onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-blue-500 focus:outline-none"
                  >
                    <option value="">{t('products.selectCategory')}</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="product-unit" className="block font-bold text-slate-700 mb-1">{t('products.unit')} *</label>
                  <select
                    id="product-unit"
                    required
                    value={formData.unit}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-blue-500 focus:outline-none bg-white"
                  >
                    <option value="">{t('products.selectUnit')}</option>
                    {UNIT_OPTIONS.map((u) => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                    {formData.unit && !UNIT_OPTIONS.includes(formData.unit) && (
                      <option value={formData.unit}>{formData.unit}</option>
                    )}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="product-cost" className="block font-bold text-slate-700 mb-1">{t('products.costPrice')} (ETB)</label>
                  <input
                    id="product-cost"
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={formData.costPrice}
                    onChange={(e) => setFormData({ ...formData, costPrice: e.target.value })}
                    placeholder="3000.00"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label htmlFor="product-selling-price" className="block font-bold text-slate-700 mb-1">{t('products.sellingPrice')} (ETB)</label>
                  <input
                    id="product-selling-price"
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={formData.sellingPrice}
                    onChange={(e) => setFormData({ ...formData, sellingPrice: e.target.value })}
                    placeholder="3450.00"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="rounded-xl border border-slate-300 px-4 py-2 font-bold text-slate-600 hover:bg-slate-50"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-xl bg-blue-600 px-5 py-2 font-bold text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {submitting ? t('common.loading') : t('common.save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CSV Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-extrabold text-base text-slate-900">{t('products.importCsv')}</h3>
              <button type="button" onClick={() => setShowImportModal(false)} aria-label={t('common.close')} className="text-slate-400 hover:text-slate-600 font-bold">
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-4 text-xs">
              <p className="text-slate-600">{t('products.importDescription')}</p>
              <button type="button" onClick={downloadTemplate} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 font-semibold text-slate-700 hover:bg-slate-50"><Download className="h-4 w-4" aria-hidden="true" />{t('products.downloadTemplate')}</button>
              <label className="block text-sm font-semibold text-slate-700">{t('products.openingStockBranch')}
                <select value={importBranchId} onChange={(e) => { setImportBranchId(e.target.value); setImportResult(null) }} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal">
                  <option value="">{t('products.noOpeningStock')}</option>{branches.filter((branch) => branch.isActive).map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
                </select>
              </label>
              <div className="rounded-xl border-2 border-dashed border-slate-300 p-5 text-center">
                <Upload className="mx-auto h-7 w-7 text-slate-400" aria-hidden="true" />
                <label className="mt-2 block cursor-pointer font-bold text-teal-800">{t('products.chooseCsv')}
                  <input type="file" accept=".csv,text/csv" onChange={handleFileUpload} className="sr-only" />
                </label>
                {importFile && <p className="mt-1 text-slate-500">{importFile.name}</p>}
              </div>
              {importError && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">{importError}</div>}
              {importBusy && <p className="text-center text-slate-500" role="status">{t('common.loading')}</p>}
              {importResult?.dryRun === true && <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="font-bold">{t('products.importCounts', { total: importResult.totalRows, valid: importResult.validRows, invalid: importResult.invalidRows })}</p>
                <div className="max-h-48 divide-y overflow-y-auto rounded-lg border bg-white">
                  {importResult.rows?.map((row) => <div key={row.row} className={`flex items-start justify-between gap-3 p-2 ${row.valid ? '' : 'bg-red-50 text-red-800'}`}>
                    <span>{t('products.csvRow', { row: row.row })}: {t('products.csvProductSummary', { name: row.data?.name || '—', sku: row.data?.sku || '—', category: row.data?.category || '—' })}</span>
                    <span className="text-right text-[11px]">{row.valid ? t('products.valid') : (row.errors || []).map((error) => t(error.code === 'NOT_FOUND' && error.field === 'category' ? 'products.csvCategoryNotFound' : `errors.${error.code}`, { defaultValue: error.code })).join(', ')}</span>
                  </div>)}
                </div>
                {importResult.rows?.some((row) => Number(row.data?.openingQuantity) > 0) && !importBranchId && <p className="text-amber-800">{t('products.selectOpeningBranch')}</p>}
              </div>}
              {importResult?.dryRun === false && <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 font-semibold text-emerald-800" role="status">{t('products.importComplete', { imported: importResult.imported, skipped: importResult.skipped })}</p>}
            </div>

            <div className="mt-6 flex justify-end gap-2 pt-3 border-t">
              <button
                type="button"
                onClick={() => setShowImportModal(false)}
                className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
              >
                {t('common.cancel')}
              </button>
              {importResult?.dryRun === true && importResult.validRows > 0 && !importResult.rows?.some((row) => Number(row.data?.openingQuantity) > 0 && !importBranchId) && (
                <button
                  type="button"
                  onClick={confirmImport}
                  disabled={importBusy}
                  className="rounded-xl bg-teal-700 px-5 py-2 text-xs font-bold text-white hover:bg-teal-800 disabled:opacity-50"
                >
                  {t('products.confirmImport', { count: importResult.validRows })}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
