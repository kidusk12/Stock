import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../auth/AuthContext'
import { api } from '../../lib/api'
import { formatETB, formatDate } from '../../lib/ethiopianDate'
import {
  ShoppingCart,
  Barcode,
  Plus,
  Minus,
  Trash2,
  Printer,
  CheckCircle2,
  AlertCircle,
  History
} from 'lucide-react'

export default function SalesPos() {
  const { user, selectedBranchId } = useAuth()
  const { t, i18n } = useTranslation()
  const isAm = i18n.language === 'am'

  const [activeTab, setActiveTab] = useState('pos') // 'pos' or 'history'
  const [products, setProducts] = useState([])
  const [salesHistory, setSalesHistory] = useState([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyPage, setHistoryPage] = useState(1)
  const [historyTotal, setHistoryTotal] = useState(0)
  const [historyFilters, setHistoryFilters] = useState({ invoiceNumber: '', from: '', to: '' })
  const [appliedHistoryFilters, setAppliedHistoryFilters] = useState({ invoiceNumber: '', from: '', to: '' })

  // POS State
  const [cart, setCart] = useState([])
  const [customerName, setCustomerName] = useState('')
  const [barcodeScanInput, setBarcodeScanInput] = useState('')
  const [saleError, setSaleError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Invoice view / print modal
  const [completedInvoice, setCompletedInvoice] = useState(null)
  const [productLoadError, setProductLoadError] = useState('')
  const [historyLoadError, setHistoryLoadError] = useState('')

  useEffect(() => {
    loadProducts()
    loadSalesHistory()
  }, [selectedBranchId])

  useEffect(() => {
    if (!completedInvoice) return undefined
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setCompletedInvoice(null)
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [completedInvoice])

  const loadProducts = () => {
    setProductLoadError('')
    if (user?.role === 'ADMIN' && !selectedBranchId) {
      setProducts([])
      return
    }
    api.get('/products', { branchId: user?.role === 'ADMIN' ? selectedBranchId : undefined, limit: 100 }).then((res) => {
      setProducts(Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [])
    }).catch((err) => {
      setProductLoadError(t(`errors.${err.code}`, { defaultValue: t('sales.productsLoadError') }))
    })
  }

  const loadSalesHistory = (page = 1, filters = appliedHistoryFilters) => {
    setHistoryLoading(true)
    setHistoryLoadError('')
    api.get('/sales', {
      branchId: user?.role === 'ADMIN' ? selectedBranchId : undefined,
      invoiceNumber: filters.invoiceNumber,
      from: filters.from,
      to: filters.to,
      page,
      limit: 20,
    }).then((res) => {
      setSalesHistory(Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [])
      setHistoryPage(res?.page || page)
      setHistoryTotal(Number(res?.total) || 0)
    }).catch((err) => {
      setHistoryLoadError(t(`errors.${err.code}`, { defaultValue: t('sales.historyLoadError') }))
    }).finally(() => setHistoryLoading(false))
  }

  const handleHistoryFilterSubmit = (event) => {
    event.preventDefault()
    setAppliedHistoryFilters(historyFilters)
    loadSalesHistory(1, historyFilters)
  }

  const clearHistoryFilters = () => {
    const emptyFilters = { invoiceNumber: '', from: '', to: '' }
    setHistoryFilters(emptyFilters)
    setAppliedHistoryFilters(emptyFilters)
    loadSalesHistory(1, emptyFilters)
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
          setSaleError(t('sales.exceedsStock'))
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
            quantity: Math.min(1, available),
            availableStock: available,
          },
        ]
      }
    })
  }

  const handleBarcodeSubmit = async (e) => {
    e.preventDefault()
    if (!barcodeScanInput.trim()) return
    if (user?.role === 'ADMIN' && !selectedBranchId) {
      setSaleError(t('sales.selectBranch'))
      return
    }
    const code = barcodeScanInput.trim().toLowerCase()
    const found = products.find(
      (p) => (p.barcode && p.barcode.toLowerCase() === code) || p.sku?.toLowerCase() === code
    )

    if (found) {
      addToCart(found)
      setBarcodeScanInput('')
      return
    }
    try {
      const searchResponse = await api.get('/products', {
        q: code,
        branchId: user?.role === 'ADMIN' ? selectedBranchId : undefined,
        limit: 20,
      })
      const searchResults = Array.isArray(searchResponse?.data) ? searchResponse.data : []
      const skuMatch = searchResults.find((product) => product.sku?.toLowerCase() === code)
      if (skuMatch) {
        addToCart(skuMatch)
        setBarcodeScanInput('')
        return
      }
      const response = await api.get(`/products/by-barcode/${encodeURIComponent(code)}`, {
        branchId: user?.role === 'ADMIN' ? selectedBranchId : undefined,
      })
      addToCart(response)
      setBarcodeScanInput('')
    } catch (err) {
      setSaleError(t(`errors.${err.code}`, { defaultValue: t('sales.productNotFound') }))
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
              setSaleError(t('sales.exceedsStock'))
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

  const setCartItemQuantity = (productId, value) => {
    const quantity = Number(value)
    const item = cart.find((entry) => entry.productId === productId)
    if (!item || !Number.isFinite(quantity) || quantity <= 0 || quantity > item.availableStock || !/^\d+(\.\d{1,2})?$/.test(String(value))) {
      setSaleError(t('sales.invalidQuantity'))
      return
    }
    setSaleError('')
    setCart((previous) => previous.map((entry) => entry.productId === productId ? { ...entry, quantity } : entry))
  }

  // Selling prices already include tax; the server calculates invoice tax.
  const totalAmount = cart.reduce((sum, item) => sum + item.quantity * item.price, 0)

  const handleCompleteSale = async () => {
    if (cart.length === 0) return
    if (user?.role === 'ADMIN' && !selectedBranchId) {
      setSaleError(t('sales.selectBranch'))
      return
    }
    setSaleError('')
    setSubmitting(true)

    try {
      const payload = {
        ...(user?.role === 'ADMIN' ? { branchId: selectedBranchId } : {}),
        customerName: customerName.trim() || undefined,
        items: cart.map((i) => ({ productId: i.productId, quantity: i.quantity })),
      }

      const saleRes = await api.post('/sales', payload)
      try {
        setCompletedInvoice(await api.get(`/sales/${saleRes.id}`))
      } catch {
        setCompletedInvoice(saleRes)
        setSaleError(t('sales.invoiceDetailsLoadError'))
      }
      setCart([])
      setCustomerName('')
      loadProducts()
      loadSalesHistory()
    } catch (err) {
      const detail = err.details?.[0]
      const product = products.find((item) => item.id === detail?.productId)
      setSaleError(detail && err.code === 'INSUFFICIENT_STOCK'
        ? t('sales.stockErrorDetail', { product: product?.name || detail.productId, available: detail.available, requested: detail.requested })
        : t(`errors.${err.code}`, { defaultValue: t('sales.saleError') }))
    } finally {
      setSubmitting(false)
    }
  }

  const handlePrintInvoice = async (sale) => {
    setSaleError('')
    try {
      setCompletedInvoice(await api.get(`/sales/${sale.id}`))
    } catch (err) {
      setSaleError(t(`errors.${err.code}`, { defaultValue: t('sales.invoiceDetailsLoadError') }))
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
          <p className="text-xs text-slate-500 mt-1">{t('sales.description')}</p>
        </div>

        <div className="inline-flex rounded-xl bg-slate-200/70 p-1 text-xs font-bold">
          <button
            onClick={() => setActiveTab('pos')}
            className={`flex items-center gap-1.5 rounded-lg px-4 py-1.5 transition ${
              activeTab === 'pos' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ShoppingCart className="h-4 w-4" />
            {t('sales.newSale')}
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

      {user?.role === 'ADMIN' && !selectedBranchId && <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{t('sales.selectBranch')}</div>}
      {productLoadError && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{productLoadError}<button type="button" onClick={loadProducts} className="ml-2 font-bold underline">{t('common.retry')}</button></div>}
      {activeTab === 'history' && saleError && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{saleError}</div>}

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
                    placeholder={t('sales.scanPlaceholder')}
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
                {t('sales.quickSelect')}
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-[460px] overflow-y-auto pr-1">
                {products.length === 0 ? <p className="col-span-full py-8 text-center text-sm text-slate-500">{user?.role === 'ADMIN' && !selectedBranchId ? t('sales.selectBranch') : t('sales.noProducts')}</p> : products.map((p) => {
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
                      {t('sales.clearCart')}
                    </button>
                  )}
                </div>

                {/* Customer Details Form */}
                <div className="mt-3 grid grid-cols-1 gap-2 text-xs">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      {t('sales.customer')}
                    </label>
                    <input
                      type="text"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      maxLength={100}
                      placeholder={t('sales.customerPlaceholder')}
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
                          <input
                            type="number"
                            min="0.01"
                            max={item.availableStock}
                            step="0.01"
                            value={item.quantity}
                            aria-label={t('sales.quantityFor', { product: item.name })}
                            onChange={(event) => setCartItemQuantity(item.productId, event.target.value)}
                            className="w-16 rounded-md border border-slate-200 px-1 py-1 text-center font-bold text-slate-900"
                          />
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
          {historyLoadError && <div role="alert" className="border-b border-red-200 bg-red-50 p-3 text-sm text-red-800">{historyLoadError}<button type="button" onClick={() => loadSalesHistory(historyPage)} className="ml-2 font-bold underline">{t('common.retry')}</button></div>}
          <form onSubmit={handleHistoryFilterSubmit} className="grid gap-3 border-b border-slate-200 p-4 sm:grid-cols-2 lg:grid-cols-[minmax(12rem,1.5fr)_repeat(2,minmax(9rem,1fr))_auto_auto] lg:items-end">
            <label className="text-xs font-semibold text-slate-600">{t('sales.invoiceNo')}<input type="search" value={historyFilters.invoiceNumber} onChange={(event) => setHistoryFilters((previous) => ({ ...previous, invoiceNumber: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" /></label>
            <label className="text-xs font-semibold text-slate-600">{t('sales.from')}<input type="date" value={historyFilters.from} max={historyFilters.to || undefined} onChange={(event) => setHistoryFilters((previous) => ({ ...previous, from: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" /></label>
            <label className="text-xs font-semibold text-slate-600">{t('sales.to')}<input type="date" value={historyFilters.to} min={historyFilters.from || undefined} onChange={(event) => setHistoryFilters((previous) => ({ ...previous, to: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" /></label>
            <button type="submit" className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-bold text-white hover:bg-teal-800">{t('sales.applyFilters')}</button>
            <button type="button" onClick={clearHistoryFilters} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50">{t('sales.clearFilters')}</button>
          </form>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase text-[11px] font-bold">
                <tr>
                  <th className="py-3 px-4">{t('sales.invoiceNo')}</th>
                  <th className="py-3 px-4">{t('sales.date')}</th>
                  <th className="py-3 px-4">{t('sales.customer')}</th>
                  <th className="py-3 px-4">{t('sales.branch')}</th>
                  <th className="py-3 px-4 text-center">{t('sales.items')}</th>
                  <th className="py-3 px-4 text-right">{t('sales.total')}</th>
                  <th className="py-3 px-4 text-center">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                {historyLoading ? (
                  <tr><td colSpan="7" className="py-8 text-center text-slate-400" role="status">{t('common.loading')}</td></tr>
                ) : salesHistory.length === 0 ? (
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
                      <td className="py-3 px-4">{s.customerName || t('sales.walkInCustomer')}</td>
                      <td className="py-3 px-4">{s.branchName}</td>
                      <td className="py-3 px-4 text-center">{s.itemCount ?? s.items?.length ?? 0}</td>
                      <td className="py-3 px-4 text-right font-extrabold text-emerald-700">
                        {formatETB(s.total, i18n.language)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => void handlePrintInvoice(s)}
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
          {!historyLoading && historyTotal > 20 && <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-sm text-slate-600"><span>{t('sales.pageSummary', { page: historyPage, pageCount: Math.ceil(historyTotal / 20), total: historyTotal })}</span><div className="flex gap-2"><button type="button" disabled={historyPage <= 1} onClick={() => loadSalesHistory(historyPage - 1)} className="rounded-lg border border-slate-300 px-3 py-1.5 font-semibold disabled:opacity-40">{t('common.previous')}</button><button type="button" disabled={historyPage >= Math.ceil(historyTotal / 20)} onClick={() => loadSalesHistory(historyPage + 1)} className="rounded-lg border border-slate-300 px-3 py-1.5 font-semibold disabled:opacity-40">{t('common.next')}</button></div></div>}
        </div>
      )}

      {/* Printable Invoice Modal (SRS Feature 5: Printable Invoice) */}
      {completedInvoice && (
        <div
          onClick={() => setCompletedInvoice(null)}
          className="invoice-print-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 overflow-y-auto cursor-pointer"
          role="presentation"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-xl rounded-2xl bg-white p-8 shadow-2xl printable-area cursor-default"
            role="dialog"
            aria-modal="true"
            aria-labelledby="invoice-title-label"
            tabIndex={-1}
          >
            {/* Action Bar (Hidden when printing) */}
            <div className="no-print flex items-center justify-between border-b pb-4 mb-6">
              <span className="font-bold text-sm text-slate-600">{t('sales.invoicePreview')}</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-blue-700"
                >
                  <Printer className="h-4 w-4" />
                  {t('sales.printInvoice')}
                </button>
                <button
                  type="button"
                  onClick={() => setCompletedInvoice(null)}
                  className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-200"
                  aria-label={t('common.close')}
                >
                  {t('common.close')}
                </button>
              </div>
            </div>

            {saleError && <p role="alert" className="no-print mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{saleError}</p>}

            {/* Invoice Header */}
            <div className="border-b-2 border-slate-800 pb-4">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-xl font-extrabold text-slate-900">
                    {completedInvoice.company?.companyName || '—'}
                  </h2>
                  {completedInvoice.company?.address && <p className="text-xs text-slate-600 mt-1">{completedInvoice.company.address}</p>}
                  {completedInvoice.company?.phone && <p className="text-xs text-slate-600 mt-1">{t('branches.phone')}: {completedInvoice.company.phone}</p>}
                  {completedInvoice.company?.tin && <p className="text-xs font-bold text-slate-800 mt-1">{t('sales.tin')}: {completedInvoice.company.tin}</p>}
                </div>
                <div className="text-right">
                  <span className="rounded bg-slate-900 px-3 py-1 text-xs font-bold text-white tracking-widest uppercase">
                    <span id="invoice-title-label">{t('sales.invoiceTitle')}</span>
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
                  <span className="text-slate-400 font-semibold">{t('sales.customer')}:</span>{' '}
                  <span className="font-bold text-slate-800">{completedInvoice.customerName || t('sales.walkInCustomer')}</span>
                </div>
                <div className="text-right">
                  <span className="text-slate-400 font-semibold">{t('sales.branch')}:</span>{' '}
                    <span className="font-bold text-slate-800">{completedInvoice.branchName || '—'}</span>
                  <div className="text-slate-600">{t('sales.cashier')}: {completedInvoice.createdBy?.name || completedInvoice.createdByName || user?.fullName}</div>
                </div>
              </div>
            </div>

            {/* Line items table */}
            <div className="mt-4">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-300 text-slate-700 font-bold uppercase text-[10px]">
                  <tr>
                    <th className="py-2">{t('products.name')}</th>
                    <th className="py-2 text-center">{t('sales.quantity')}</th>
                    <th className="py-2 text-right">{t('sales.unitPrice')}</th>
                    <th className="py-2 text-right">{t('sales.lineTotal')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {completedInvoice.items?.map((item, idx) => (
                    <tr key={idx}>
                      <td className="py-2 font-medium text-slate-900">
                        {item.productName || item.name || '—'}
                        <div className="text-[10px] font-mono text-slate-400">{item.sku}</div>
                      </td>
                      <td className="py-2 text-center font-bold">{item.quantity}</td>
                      <td className="py-2 text-right text-slate-600">{formatETB(item.unitPrice ?? item.sellingPrice, i18n.language)}</td>
                      <td className="py-2 text-right font-bold text-slate-900">{formatETB(item.lineTotal ?? item.total ?? (Number(item.quantity) * Number(item.unitPrice ?? item.sellingPrice)), i18n.language)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Summary */}
            <div className="mt-6 border-t-2 border-slate-800 pt-3 text-xs space-y-1">
              <div className="flex justify-between text-slate-600">
                <span>{t('sales.subtotal')}:</span>
                <span className="font-mono">{formatETB(completedInvoice.netAmount ?? completedInvoice.subtotal ?? 0, i18n.language)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>{completedInvoice.taxType ? `${completedInvoice.taxType} ` : ''}{completedInvoice.taxRate != null ? `(${completedInvoice.taxRate}%)` : t('sales.tax')}:</span>
                <span className="font-mono">{formatETB(completedInvoice.taxAmount ?? completedInvoice.tax ?? 0, i18n.language)}</span>
              </div>
              <div className="flex justify-between text-base font-extrabold text-slate-900 pt-1 border-t">
                <span>{t('sales.total')}:</span>
                <span className="font-mono text-emerald-800">{formatETB(completedInvoice.total ?? 0, i18n.language)}</span>
              </div>
            </div>

            <div className="mt-8 text-center text-[10px] text-slate-400 border-t pt-3">
              {t('sales.thankYou')}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
