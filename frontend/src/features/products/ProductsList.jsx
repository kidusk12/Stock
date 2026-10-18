import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../auth/AuthContext'
import { api } from '../../lib/api'
import { formatETB } from '../../lib/ethiopianDate'
import {
  Boxes,
  Search,
  Plus,
  FileSpreadsheet,
  AlertTriangle,
  Building2,
  Barcode,
  CheckCircle2,
  XCircle,
  Eye,
  Upload,
  Download
} from 'lucide-react'

export default function ProductsList() {
  const { user, selectedBranchId } = useAuth()
  const { t, i18n } = useTranslation()
  const isAm = i18n.language === 'am'

  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedCat, setSelectedCat] = useState('')

  // Modals
  const [showAddModal, setShowAddModal] = useState(false)
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
    openingStock: '0',
    minQuantity: '10',
    maxQuantity: '100',
  })
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // CSV Import state
  const [importRows, setImportRows] = useState([])
  const [importValidation, setImportValidation] = useState(null)

  useEffect(() => {
    loadProducts()
    api.get('/categories').then((res) => setCategories(res.data || [])).catch(() => {})
  }, [selectedBranchId, search, selectedCat])

  const loadProducts = () => {
    setLoading(true)
    api.get('/products', {
      branchId: selectedBranchId,
      q: search,
      categoryId: selectedCat || undefined,
    })
      .then((res) => {
        setProducts(res.data || [])
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false))
  }

  const handleCreateProduct = async (e) => {
    e.preventDefault()
    setFormError('')
    setSubmitting(true)

    try {
      await api.post('/products', formData)
      setShowAddModal(false)
      setFormData({
        name: '',
        sku: '',
        barcode: '',
        categoryId: '1',
        unit: 'piece',
        costPrice: '',
        sellingPrice: '',
        openingStock: '0',
        minQuantity: '10',
        maxQuantity: '100',
      })
      loadProducts()
    } catch (err) {
      setFormError(err.message || t(`errors.${err.code}`, 'Error saving product'))
    } finally {
      setSubmitting(false)
    }
  }

  // CSV Import simulation
  const handleFileUpload = (e) => {
    const file = e.target.files[0]
    if (!file) return

    // Preview sample data
    const preview = [
      { name: 'Brown Teff 25kg', sku: 'TEF-BRN', barcode: '6001009', unit: 'bag', costPrice: 3400, sellingPrice: 3900, status: 'VALID' },
      { name: 'Pure Honey 1kg', sku: 'HNY-1KG', barcode: '6001010', unit: 'jar', costPrice: 400, sellingPrice: 550, status: 'VALID' },
      { name: 'Invalid Duplicate SKU', sku: 'SUG-50', barcode: '6001011', unit: 'bag', costPrice: 200, sellingPrice: 250, status: 'ERROR', error: 'Duplicate SKU' },
    ]
    setImportRows(preview)
    setImportValidation({ valid: 2, errors: 1 })
  }

  const confirmImport = async () => {
    // Add valid rows
    for (const r of importRows.filter(x => x.status === 'VALID')) {
      await api.post('/products', {
        name: r.name,
        sku: r.sku,
        barcode: r.barcode,
        categoryId: 1,
        unit: r.unit,
        costPrice: r.costPrice,
        sellingPrice: r.sellingPrice,
        openingStock: 20,
        minQuantity: 10,
        maxQuantity: 100
      }).catch(() => {})
    }
    setShowImportModal(false)
    setImportRows([])
    setImportValidation(null)
    loadProducts()
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
            {isAm ? 'የምርት ካታሎግ፣ ዋጋዎች እና የክምችት መጠን' : 'Product catalog, pricing, and branch stock on hand'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {user?.role === 'ADMIN' && (
            <>
              <button
                onClick={() => setShowImportModal(true)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50 transition"
              >
                <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                {t('products.importCsv')}
              </button>
              <button
                onClick={() => setShowAddModal(true)}
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
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('products.scanBarcode')}
            className="w-full rounded-xl border border-slate-200 pl-10 pr-4 py-2 text-xs focus:border-blue-500 focus:outline-none"
          />
        </div>

        <div className="w-full sm:w-56">
          <select
            value={selectedCat}
            onChange={(e) => setSelectedCat(e.target.value)}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 focus:border-blue-500 focus:outline-none"
          >
            <option value="">{isAm ? 'ሁሉም ምድቦች' : 'All Categories'}</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Products Table */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-soft overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase tracking-wider text-[11px] font-bold">
              <tr>
                <th className="py-3.5 px-4">{t('products.name')}</th>
                <th className="py-3.5 px-4">{t('products.sku')} / {t('products.barcode')}</th>
                <th className="py-3.5 px-4">{t('products.category')}</th>
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
                  <td colSpan="7" className="py-8 text-center text-slate-400">
                    {t('common.loading')}
                  </td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan="7" className="py-8 text-center text-slate-400">
                    {t('common.noData')}
                  </td>
                </tr>
              ) : (
                products.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/70 transition">
                    <td className="py-3 px-4 font-bold text-slate-900">
                      {p.name}
                      {p.isLowStock && (
                        <span className="ml-2 inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700 border border-amber-200">
                          <AlertTriangle className="h-3 w-3" />
                          {isAm ? 'ዝቅተኛ' : 'Low'}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-600 font-mono text-[11px]">
                      <div>{p.sku}</div>
                      {p.barcode && <div className="text-slate-400 text-[10px]">{p.barcode}</div>}
                    </td>
                    <td className="py-3 px-4">
                      <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-700">
                        {p.categoryName || 'General'}
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
                      <button
                        onClick={() => setShowBranchModal(p)}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-bold text-slate-600 hover:bg-slate-100 transition"
                        title="View stock across branches"
                      >
                        <Building2 className="h-3.5 w-3.5 text-blue-600" />
                        {t('products.branchStock')}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

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
                        Min: {bs.minQuantity} | Max: {bs.maxQuantity}
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
              <h3 className="font-extrabold text-base text-slate-900">{t('products.addProduct')}</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600 font-bold">
                ✕
              </button>
            </div>

            {formError && (
              <div className="mt-3 rounded-lg bg-red-50 p-2.5 text-xs font-semibold text-red-700 border border-red-200">
                {formError}
              </div>
            )}

            <form onSubmit={handleCreateProduct} className="mt-4 space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">{t('products.name')} *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Sugar 50kg (ስኳር 50 ኪ.ግ)"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">{t('products.sku')} *</label>
                  <input
                    type="text"
                    required
                    value={formData.sku}
                    onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                    placeholder="e.g. SUG-50"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">{t('products.barcode')}</label>
                  <input
                    type="text"
                    value={formData.barcode}
                    onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                    placeholder="e.g. 6001001"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">{t('products.category')}</label>
                  <select
                    value={formData.categoryId}
                    onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-blue-500 focus:outline-none"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">{t('products.unit')}</label>
                  <input
                    type="text"
                    value={formData.unit}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                    placeholder="bag, kg, piece, carton"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">{t('products.costPrice')} (ETB)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={formData.costPrice}
                    onChange={(e) => setFormData({ ...formData, costPrice: e.target.value })}
                    placeholder="3000.00"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">{t('products.sellingPrice')} (ETB)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={formData.sellingPrice}
                    onChange={(e) => setFormData({ ...formData, sellingPrice: e.target.value })}
                    placeholder="3450.00"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">{isAm ? 'መነሻ ክምችት' : 'Opening Stock'}</label>
                  <input
                    type="number"
                    value={formData.openingStock}
                    onChange={(e) => setFormData({ ...formData, openingStock: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">{t('products.minQuantity')}</label>
                  <input
                    type="number"
                    value={formData.minQuantity}
                    onChange={(e) => setFormData({ ...formData, minQuantity: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">{t('products.maxQuantity')}</label>
                  <input
                    type="number"
                    value={formData.maxQuantity}
                    onChange={(e) => setFormData({ ...formData, maxQuantity: e.target.value })}
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
              <button onClick={() => setShowImportModal(false)} className="text-slate-400 hover:text-slate-600 font-bold">
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-4 text-xs">
              <p className="text-slate-600">
                {isAm
                  ? 'ምርቶችን በብዛት በአንድ ጊዜ ለማስመጣት የ CSV ፋይል ይጫኑ። ስርዓቱ መረጃውን አስቀድሞ በመፈተሽ ትክክለኛነቱን ያረጋግጣል።'
                  : 'Upload a CSV file to import multiple products at once. The system will preview and validate every row before inserting.'}
              </p>

              <div className="rounded-xl border-2 border-dashed border-slate-300 p-6 text-center hover:bg-slate-50 transition cursor-pointer">
                <Upload className="mx-auto h-8 w-8 text-slate-400" />
                <label className="mt-2 block font-bold text-blue-600 cursor-pointer">
                  <span>{isAm ? 'የ CSV ፋይል ይምረጡ' : 'Select a CSV file to upload'}</span>
                  <input type="file" accept=".csv" onChange={handleFileUpload} className="hidden" />
                </label>
                <p className="mt-1 text-[11px] text-slate-400">Columns: Name, SKU, Barcode, Unit, CostPrice, SellingPrice</p>
              </div>

              {importValidation && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                  <div className="flex justify-between font-bold">
                    <span className="text-emerald-700 flex items-center gap-1">
                      <CheckCircle2 className="h-4 w-4" /> {importValidation.valid} Valid rows ready
                    </span>
                    <span className="text-red-600 flex items-center gap-1">
                      <XCircle className="h-4 w-4" /> {importValidation.errors} Errors found
                    </span>
                  </div>

                  <div className="max-h-40 overflow-y-auto divide-y divide-slate-200 border rounded-lg bg-white">
                    {importRows.map((r, i) => (
                      <div key={i} className={`p-2 flex justify-between items-center text-[11px] ${r.status === 'ERROR' ? 'bg-red-50 text-red-700' : ''}`}>
                        <span>{r.name} ({r.sku})</span>
                        {r.status === 'ERROR' ? (
                          <span className="font-bold">{r.error}</span>
                        ) : (
                          <span className="text-emerald-600 font-semibold">Valid</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end gap-2 pt-3 border-t">
              <button
                onClick={() => setShowImportModal(false)}
                className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
              >
                {t('common.cancel')}
              </button>
              {importValidation?.valid > 0 && (
                <button
                  onClick={confirmImport}
                  className="rounded-xl bg-blue-600 px-5 py-2 text-xs font-bold text-white hover:bg-blue-700"
                >
                  {isAm ? 'ትክክለኛዎቹን አስመጣ' : `Import ${importValidation.valid} Products`}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
