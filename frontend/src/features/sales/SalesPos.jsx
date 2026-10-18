import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../auth/AuthContext'
import { api } from '../../lib/api'
import { formatETB, formatDate, toEthiopianDate } from '../../lib/ethiopianDate'
import {
  ShoppingCart,
  Barcode,
  Search,
  Plus,
  Minus,
  Trash2,
  Printer,
  CheckCircle2,
  AlertCircle,
  FileText,
  User,
  History
} from 'lucide-react'

export default function SalesPos() {
  const { user, selectedBranchId } = useAuth()
  const { t, i18n } = useTranslation()
  const isAm = i18n.language === 'am'

  const [activeTab, setActiveTab] = useState('pos') // 'pos' or 'history'
  const [products, setProducts] = useState([])
  const [salesHistory, setSalesHistory] = useState([])
  const [loading, setLoading] = useState(false)

  // POS State
  const [cart, setCart] = useState([])
  const [customerName, setCustomerName] = useState('')
  const [customerTin, setCustomerTin] = useState('')
  const [barcodeScanInput, setBarcodeScanInput] = useState('')
  const [saleError, setSaleError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Invoice view / print modal
  const [completedInvoice, setCompletedInvoice] = useState(null)
  const [companySettings, setCompanySettings] = useState(null)

  useEffect(() => {
    loadProducts()
    loadSalesHistory()
    api.get('/settings').then(setCompanySettings).catch(() => {})
  }, [selectedBranchId])

  const loadProducts = () => {
    api.get('/products', { branchId: selectedBranchId }).then((res) => {
      setProducts(res.data || [])
    }).catch(() => {})
  }

  const loadSalesHistory = () => {
    api.get('/sales', { branchId: selectedBranchId }).then((res) => {
      setSalesHistory(res.data || [])
    }).catch(() => {})
  }

  // Add product to cart by object or barcode
  const addToCart = (product) => {
    setSaleError('')
    const available = product.quantity || 0
    if (available <= 0) {
      setSaleError(t('errors.INSUFFICIENT_STOCK', 'No stock available for this product'))
      return
    }

    setCart((prev) => {
      const existing = prev.find((item) => item.productId === product.id)
      if (existing) {
        if (existing.quantity + 1 > available) {
          setSaleError(isAm ? 'ከተገኘው ክምችት በላይ መሸጥ አይቻልም' : 'Cannot exceed available stock')
          return prev
        }
        return prev.map((item) =>
          item.productId === product.id ? { ...item, quantity: item.quantity + 1 } : item
        )
      } else {
        return [
          ...prev,
          {
            productId: product.id,
            name: product.name,
            sku: product.sku,
            unit: product.unit,
            price: Number(product.sellingPrice),
            quantity: 1,
            availableStock: available,
          },
        ]
      }
    })
  }

  const handleBarcodeSubmit = (e) => {
    e.preventDefault()
    if (!barcodeScanInput.trim()) return
    const code = barcodeScanInput.trim().toLowerCase()
    const found = products.find(
      (p) => (p.barcode && p.barcode.toLowerCase() === code) || p.sku.toLowerCase() === code
    )

    if (found) {
      addToCart(found)
      setBarcodeScanInput('')
    } else {
      setSaleError(t('errors.PRODUCT_NOT_FOUND', 'Product not found for scanned barcode'))
    }
  }

  const updateCartQty = (productId, delta) => {
    setSaleError('')
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.productId === productId) {
            const newQty = item.quantity + delta
            if (newQty > item.availableStock) {
              setSaleError(isAm ? 'ከተገኘው ክምችት በላይ መሸጥ አይቻልም' : 'Cannot exceed available stock')
              return item
            }
            return { ...item, quantity: newQty }
          }
          return item
        })
        .filter((item) => item.quantity > 0)
    )
  }

  const removeFromCart = (productId) => {
    setCart((prev) => prev.filter((item) => item.productId !== productId))
  }

  // Calculate totals (tax included in selling price per Team Contract T1)
  const taxRate = companySettings?.taxRate || 0.15
  const totalAmount = cart.reduce((sum, item) => sum + item.quantity * item.price, 0)
  const subtotal = totalAmount / (1 + taxRate)
  const taxAmount = totalAmount - subtotal

  const handleCompleteSale = async () => {
    if (cart.length === 0) return
    setSaleError('')
    setSubmitting(true)

    try {
      const payload = {
        customerName: customerName.trim() || undefined,
        customerTin: customerTin.trim() || undefined,
        items: cart.map((i) => ({ productId: i.productId, quantity: i.quantity })),
      }

      const saleRes = await api.post('/sales', payload)
      setCompletedInvoice(saleRes)
      setCart([])
      setCustomerName('')
      setCustomerTin('')
      loadProducts()
      loadSalesHistory()
    } catch (err) {
      setSaleError(err.message || t(`errors.${err.code}`, 'Failed to complete sale'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header and Mode switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            {t('sales.title')}
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            {isAm ? 'ፈጣን የሽያጭ ነጥብ እና ሕጋዊ ደረሰኝ ማውጫ' : 'Point of sale counter and tax invoice generator'}
          </p>
        </div>

        <div className="inline-flex rounded-xl bg-slate-200/70 p-1 text-xs font-bold">
          <button
            onClick={() => setActiveTab('pos')}
            className={`flex items-center gap-1.5 rounded-lg px-4 py-1.5 transition ${
              activeTab === 'pos' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ShoppingCart className="h-4 w-4" />
            {isAm ? 'አዲስ ሽያጭ (POS)' : 'New Sale (POS)'}
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`flex items-center gap-1.5 rounded-lg px-4 py-1.5 transition ${
              activeTab === 'history' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <History className="h-4 w-4" />
            {t('sales.history')} ({salesHistory.length})
          </button>
        </div>
      </div>

      {activeTab === 'pos' ? (
        <div className="grid gap-6 lg:grid-cols-12">
          {/* Left Column: Barcode & Product Catalog (7 cols) */}
          <div className="lg:col-span-7 space-y-4">
            {/* Barcode scanner input */}
            <form onSubmit={handleBarcodeSubmit} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-soft">
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                {t('sales.scanProduct')}
              </label>
              <div className="relative flex gap-2">
                <div className="relative flex-1">
                  <Barcode className="absolute left-3 top-2.5 h-4 w-4 text-blue-600" />
                  <input
                    type="text"
                    value={barcodeScanInput}
                    onChange={(e) => setBarcodeScanInput(e.target.value)}
                    placeholder={isAm ? 'ባርኮድ ወይም SKU ይቃኙና Enter ይጫኑ...' : 'Scan barcode or type SKU and hit Enter...'}
                    className="w-full rounded-xl border border-slate-200 pl-10 pr-3 py-2 text-xs font-mono focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <button
                  type="submit"
                  className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 transition"
                >
                  {t('common.add')}
                </button>
              </div>
            </form>

            {saleError && (
              <div className="flex items-center gap-2 rounded-xl bg-red-50 p-3 text-xs font-semibold text-red-700 border border-red-200">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{saleError}</span>
              </div>
            )}

            {/* Quick Product Grid */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-soft">
              <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-3">
                {isAm ? 'ዕቃዎችን በፍጥነት ይምረጡ' : 'Quick Select Items'}
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-[460px] overflow-y-auto pr-1">
                {products.map((p) => {
                  const outOfStock = p.quantity <= 0
                  return (
                    <button
                      key={p.id}
                      type="button"
                      disabled={outOfStock}
                      onClick={() => addToCart(p)}
                      className={`flex flex-col justify-between rounded-xl border p-3 text-left transition ${
                        outOfStock
                          ? 'border-slate-100 bg-slate-50 opacity-40 cursor-not-allowed'
                          : 'border-slate-200 bg-white hover:border-blue-400 hover:shadow-xs'
                      }`}
                    >
                      <div>
                        <div className="font-bold text-xs text-slate-900 line-clamp-1">{p.name}</div>
                        <div className="text-[10px] font-mono text-slate-400 mt-0.5">{p.sku}</div>
                      </div>
                      <div className="mt-3 flex items-center justify-between text-xs">
                        <span className="font-extrabold text-blue-700">
                          {formatETB(p.sellingPrice, i18n.language)}
                        </span>
                        <span className={`text-[10px] font-bold ${p.quantity <= 5 ? 'text-amber-600' : 'text-slate-500'}`}>
                          {p.quantity} {p.unit}
                        </span>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Right Column: Cart & Checkout (5 cols) */}
          <div className="lg:col-span-5 space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft flex flex-col justify-between min-h-[500px]">
              <div>
                <div className="flex items-center justify-between border-b pb-3">
                  <h3 className="font-extrabold text-base text-slate-900 flex items-center gap-2">
                    <ShoppingCart className="h-5 w-5 text-blue-600" />
                    {t('sales.cart')} ({cart.length})
                  </h3>
                  {cart.length > 0 && (
                    <button
                      onClick={() => setCart([])}
                      className="text-[11px] font-semibold text-red-600 hover:underline"
                    >
                      {isAm ? 'ጋሪ አጽዳ' : 'Clear cart'}
                    </button>
                  )}
                </div>

                {/* Customer Details Form */}
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      {t('sales.customer')}
                    </label>
                    <input
                      type="text"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="e.g. Ato Girma"
                      className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      {t('sales.customerTin')}
                    </label>
                    <input
                      type="text"
                      value={customerTin}
                      onChange={(e) => setCustomerTin(e.target.value)}
                      placeholder="0012345678"
                      className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Cart Items List */}
                <div className="mt-4 divide-y divide-slate-100 max-h-60 overflow-y-auto">
                  {cart.length === 0 ? (
                    <div className="py-12 text-center text-xs text-slate-400">
                      {t('sales.emptyCart')}
                    </div>
                  ) : (
                    cart.map((item) => (
                      <div key={item.productId} className="py-2.5 flex items-center justify-between gap-2 text-xs">
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-slate-800 truncate">{item.name}</p>
                          <p className="text-[10px] text-slate-500 font-mono">
                            {formatETB(item.price, i18n.language)} × {item.quantity}
                          </p>
                        </div>

                        {/* Qty Controls */}
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => updateCartQty(item.productId, -1)}
                            className="grid h-6 w-6 place-items-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-100"
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <span className="w-6 text-center font-bold text-slate-900">{item.quantity}</span>
                          <button
                            type="button"
                            onClick={() => updateCartQty(item.productId, 1)}
                            className="grid h-6 w-6 place-items-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-100"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>

                        <span className="w-20 text-right font-extrabold text-slate-900">
                          {formatETB(item.quantity * item.price, i18n.language)}
                        </span>

                        <button
                          type="button"
                          onClick={() => removeFromCart(item.productId)}
                          className="text-slate-400 hover:text-red-600 p-1"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Summary & Checkout */}
              <div className="mt-6 border-t pt-4 space-y-2 text-xs">
                <div className="flex justify-between text-slate-500">
                  <span>{t('sales.subtotal')}</span>
                  <span>{formatETB(subtotal, i18n.language)}</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>
                    {companySettings?.taxType || 'VAT'} ({Math.round(taxRate * 100)}%)
                  </span>
                  <span>{formatETB(taxAmount, i18n.language)}</span>
                </div>
                <div className="flex justify-between text-base font-extrabold text-slate-900 pt-2 border-t">
                  <span>{t('sales.total')}</span>
                  <span className="text-emerald-700">{formatETB(totalAmount, i18n.language)}</span>
                </div>

                <button
                  type="button"
                  disabled={cart.length === 0 || submitting}
                  onClick={handleCompleteSale}
                  className="w-full mt-4 rounded-xl bg-emerald-600 py-3 text-sm font-extrabold text-white shadow-soft hover:bg-emerald-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <CheckCircle2 className="h-5 w-5" />
                  {submitting ? t('common.loading') : t('sales.completeSale')}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Sales History View */
        <div className="rounded-2xl border border-slate-200 bg-white shadow-soft overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase text-[11px] font-bold">
                <tr>
                  <th className="py-3 px-4">{t('sales.invoiceNo')}</th>
                  <th className="py-3 px-4">{t('sales.date')}</th>
                  <th className="py-3 px-4">{isAm ? 'ደንበኛ' : 'Customer'}</th>
                  <th className="py-3 px-4">{isAm ? 'ቅርንጫፍ' : 'Branch'}</th>
                  <th className="py-3 px-4 text-center">{t('sales.items')}</th>
                  <th className="py-3 px-4 text-right">{t('sales.total')}</th>
                  <th className="py-3 px-4 text-center">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                {salesHistory.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="py-8 text-center text-slate-400">
                      {t('common.noData')}
                    </td>
                  </tr>
                ) : (
                  salesHistory.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50/70">
                      <td className="py-3 px-4 font-mono font-bold text-blue-700">{s.invoiceNumber}</td>
                      <td className="py-3 px-4 text-slate-500">{formatDate(s.createdAt, i18n.language)}</td>
                      <td className="py-3 px-4">{s.customerName}</td>
                      <td className="py-3 px-4">{s.branchName}</td>
                      <td className="py-3 px-4 text-center">{s.items?.length || 0}</td>
                      <td className="py-3 px-4 text-right font-extrabold text-emerald-700">
                        {formatETB(s.total, i18n.language)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => setCompletedInvoice(s)}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-bold text-slate-700 hover:bg-slate-100"
                        >
                          <Printer className="h-3.5 w-3.5 text-blue-600" />
                          {t('sales.printInvoice')}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Printable Invoice Modal (SRS Feature 5: Printable Invoice) */}
      {completedInvoice && (
        <div
          onClick={() => setCompletedInvoice(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 overflow-y-auto cursor-pointer"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-xl rounded-2xl bg-white p-8 shadow-2xl printable-area cursor-default"
          >
            {/* Action Bar (Hidden when printing) */}
            <div className="no-print flex items-center justify-between border-b pb-4 mb-6">
              <span className="font-bold text-sm text-slate-600">
                {isAm ? 'የሽያጭ ደረሰኝ ቅድመ-ዕይታ' : 'Invoice Preview'}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-blue-700"
                >
                  <Printer className="h-4 w-4" />
                  {t('sales.printInvoice')}
                </button>
                <button
                  onClick={() => setCompletedInvoice(null)}
                  className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-200"
                >
                  {t('common.close')}
                </button>
              </div>
            </div>

            {/* Invoice Header */}
            <div className="border-b-2 border-slate-800 pb-4">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-xl font-extrabold text-slate-900">
                    {companySettings?.companyName || 'Berhan Stock PLC'}
                  </h2>
                  <p className="text-xs text-slate-600 mt-1">
                    {companySettings?.address || 'Addis Ababa, Ethiopia'}
                  </p>
                  <p className="text-xs text-slate-600">
                    Phone: {companySettings?.phone || '+251 11 661 2345'}
                  </p>
                  <p className="text-xs font-bold text-slate-800 mt-1">
                    TIN: {companySettings?.tin || '0012345678'}
                  </p>
                </div>
                <div className="text-right">
                  <span className="rounded bg-slate-900 px-3 py-1 text-xs font-bold text-white tracking-widest uppercase">
                    Tax Invoice
                  </span>
                  <p className="mt-2 text-sm font-mono font-bold text-blue-900">
                    {completedInvoice.invoiceNumber}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {formatDate(completedInvoice.createdAt, i18n.language)}
                  </p>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-200 grid grid-cols-2 text-xs">
                <div>
                  <span className="text-slate-400 font-semibold">{isAm ? 'ደንበኛ:' : 'Customer:'}</span>{' '}
                  <span className="font-bold text-slate-800">{completedInvoice.customerName || 'Walk-in'}</span>
                  {completedInvoice.customerTin && (
                    <div className="text-slate-600">TIN: {completedInvoice.customerTin}</div>
                  )}
                </div>
                <div className="text-right">
                  <span className="text-slate-400 font-semibold">{isAm ? 'ቅርንጫፍ:' : 'Branch:'}</span>{' '}
                  <span className="font-bold text-slate-800">{completedInvoice.branchName}</span>
                  <div className="text-slate-600">{t('sales.cashier')}: {completedInvoice.createdByName || user?.fullName}</div>
                </div>
              </div>
            </div>

            {/* Line items table */}
            <div className="mt-4">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-300 text-slate-700 font-bold uppercase text-[10px]">
                  <tr>
                    <th className="py-2">{t('products.name')}</th>
                    <th className="py-2 text-center">{isAm ? 'ብዛት' : 'Qty'}</th>
                    <th className="py-2 text-right">{isAm ? 'የአንዱ ዋጋ' : 'Unit Price'}</th>
                    <th className="py-2 text-right">{isAm ? 'ጠቅላላ' : 'Total'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {completedInvoice.items?.map((item, idx) => (
                    <tr key={idx}>
                      <td className="py-2 font-medium text-slate-900">
                        {item.productName}
                        <div className="text-[10px] font-mono text-slate-400">{item.sku}</div>
                      </td>
                      <td className="py-2 text-center font-bold">{item.quantity}</td>
                      <td className="py-2 text-right text-slate-600">{formatETB(item.unitPrice, i18n.language)}</td>
                      <td className="py-2 text-right font-bold text-slate-900">{formatETB(item.total, i18n.language)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Summary */}
            <div className="mt-6 border-t-2 border-slate-800 pt-3 text-xs space-y-1">
              <div className="flex justify-between text-slate-600">
                <span>{t('sales.subtotal')}:</span>
                <span className="font-mono">{formatETB(completedInvoice.subtotal, i18n.language)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>{companySettings?.taxType || 'VAT'} ({Math.round((companySettings?.taxRate || 0.15) * 100)}%):</span>
                <span className="font-mono">{formatETB(completedInvoice.tax, i18n.language)}</span>
              </div>
              <div className="flex justify-between text-base font-extrabold text-slate-900 pt-1 border-t">
                <span>{t('sales.total')}:</span>
                <span className="font-mono text-emerald-800">{formatETB(completedInvoice.total, i18n.language)}</span>
              </div>
            </div>

            <div className="mt-8 text-center text-[10px] text-slate-400 border-t pt-3">
              {isAm ? 'ስለመረጡን እናመሰግናለን! · Berhan Stock Management System' : 'Thank you for your business! · Berhan Stock System'}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
