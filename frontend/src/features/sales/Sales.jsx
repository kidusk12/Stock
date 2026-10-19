import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../auth/AuthContext'
import { api } from '../../lib/api'
import { errorKey } from '../../lib/errorMessages'
import { lookupProductByBarcode } from '../../lib/productLookup'
import { roundMoney, useFormatBirr } from '../../lib/money'
import BarcodeInput from '../../components/BarcodeInput'

// The branch list may come back as a plain array or as { data: [...] }. Handle both.
const asList = (res) => (Array.isArray(res) ? res : (res?.data ?? []))

function ProductSearch({ branchId, onPick }) {
  const { t } = useTranslation()
  const formatMoney = useFormatBirr()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searched, setSearched] = useState('') // the query that `results` belong to

  useEffect(() => {
    const q = query.trim()
    if (!q) return
    let cancelled = false
    const timer = setTimeout(() => {
      api
        .get('/products', { q, branchId, limit: 8 }) // with branchId, each product includes its stock quantity
        .then((res) => {
          if (cancelled) return
          setResults(res.data)
          setSearched(q)
        })
        .catch(() => {
          if (cancelled) return
          setResults([])
          setSearched(q)
        })
    }, 300) // wait for the user to stop typing
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [query, branchId])

  const showing = query.trim() !== '' && searched === query.trim()

  return (
    <div>
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t('sales.searchPlaceholder')}
        aria-label={t('sales.searchPlaceholder')}
        className="w-full border rounded px-3 py-2"
      />
      {showing && (
        <ul className="mt-2 border rounded divide-y bg-white">
          {results.length === 0 ? (
            <li className="p-3 text-sm text-gray-500">{t('sales.noResults')}</li>
          ) : (
            results.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => {
                    onPick(p)
                    setQuery('')
                  }}
                  className="w-full text-left p-3 hover:bg-gray-50 flex justify-between gap-3"
                >
                  <span className="min-w-0">
                    <span className="block font-medium truncate">{p.name}</span>
                    <span className="block text-xs text-gray-500">
                      {p.sku} · {t('sales.stock', { qty: p.quantity ?? 0 })}
                    </span>
                  </span>
                  <span className="shrink-0">{formatMoney(p.sellingPrice)}</span>
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  )
}

export default function Sales() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const formatMoney = useFormatBirr()

  const [branches, setBranches] = useState([])
  const [chosenBranch, setChosenBranch] = useState('')
  const [cart, setCart] = useState([]) // [{ product, quantity }]
  const cartRef = useRef(cart) // always the latest cart, so two fast scans never overwrite each other
  const [customerName, setCustomerName] = useState('')
  const [notice, setNotice] = useState(null) // { key, params }
  const [submitting, setSubmitting] = useState(false)
  const [receipt, setReceipt] = useState(null) // the sale the server returned

  // Manager and Staff sell from their own branch. Admin has none, so they pick one.
  const mustPickBranch = !user.branchId
  const branchId = user.branchId ?? (chosenBranch ? Number(chosenBranch) : null)

  useEffect(() => {
    if (!mustPickBranch) return
    let cancelled = false
    api
      .get('/branches')
      .then((res) => {
        if (!cancelled) setBranches(asList(res))
      })
      .catch((err) => {
        if (!cancelled) setNotice({ key: errorKey(err), params: {} })
      })
    return () => {
      cancelled = true
    }
  }, [mustPickBranch])

  const commitCart = (next) => {
    cartRef.current = next
    setCart(next)
  }

  const addToCart = (product) => {
    const available = product.quantity ?? 0
    const line = cartRef.current.find((l) => l.product.id === product.id)
    const current = line ? line.quantity : 0

    if (available <= 0) {
      setNotice({ key: 'sales.outOfStock', params: { name: product.name } })
      return
    }
    if (current + 1 > available) {
      setNotice({ key: 'sales.maxReached', params: { name: product.name, qty: available } })
      return
    }

    setNotice(null)
    setReceipt(null)
    commitCart(
      line
        ? cartRef.current.map((l) => (l.product.id === product.id ? { ...l, quantity: current + 1 } : l))
        : [...cartRef.current, { product, quantity: 1 }],
    )
  }

  const changeQuantity = (productId, raw) => {
    const line = cartRef.current.find((l) => l.product.id === productId)
    if (!line) return
    const available = line.product.quantity ?? 0
    let quantity = Math.floor(Number(raw))
    if (!Number.isFinite(quantity) || quantity < 1) quantity = 1
    if (quantity > available) {
      quantity = available
      setNotice({ key: 'sales.maxReached', params: { name: line.product.name, qty: available } })
    } else {
      setNotice(null)
    }
    commitCart(cartRef.current.map((l) => (l.product.id === productId ? { ...l, quantity } : l)))
  }

  const removeLine = (productId) => commitCart(cartRef.current.filter((l) => l.product.id !== productId))

  const handleBranchChange = (value) => {
    setChosenBranch(value)
    commitCart([]) // stock differs per branch, so start a fresh cart
    setNotice(null)
  }

  const completeSale = async () => {
    if (cartRef.current.length === 0 || submitting) return
    setSubmitting(true)
    setNotice(null)
    try {
      // Contract 6.6: no prices in the request. The server uses the current selling price.
      const sale = await api.post('/sales', {
        branchId,
        customerName: customerName.trim() || undefined,
        items: cartRef.current.map((l) => ({ productId: l.product.id, quantity: l.quantity })),
      })
      setReceipt(sale)
      commitCart([])
      setCustomerName('')
    } catch (err) {
      setNotice({ key: errorKey(err), params: {} })
    } finally {
      setSubmitting(false)
    }
  }

  // Prices already include tax, so the total is just the sum of the lines (no tax added on top)
  const lines = cart.map((l) => ({ ...l, lineTotal: roundMoney(l.product.sellingPrice * l.quantity) }))
  const total = roundMoney(lines.reduce((sum, l) => sum + l.lineTotal, 0))

  return (
    <div className="max-w-6xl mx-auto">
      <h1 className="text-2xl font-semibold mb-4">{t('sales.title')}</h1>

      {mustPickBranch && (
        <div className="mb-4">
          <label htmlFor="sale-branch" className="block text-sm mb-1">
            {t('sales.branch')}
          </label>
          <select
            id="sale-branch"
            value={chosenBranch}
            onChange={(e) => handleBranchChange(e.target.value)}
            className="border rounded px-3 py-2 bg-white"
          >
            <option value="">{t('sales.selectBranch')}</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {receipt && (
        <div className="mb-4 rounded border border-green-300 bg-green-50 p-4" role="status">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-semibold text-green-800">{t('sales.done.title')}</p>
              <p className="text-sm">{t('sales.done.invoice', { number: receipt.invoiceNumber })}</p>
            </div>
            <button type="button" onClick={() => setReceipt(null)} className="text-sm text-brand underline">
              {t('sales.done.newSale')}
            </button>
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-y-1 text-sm max-w-sm">
            <dt>{t('sales.done.net')}</dt>
            <dd className="text-right">{formatMoney(receipt.netAmount)}</dd>
            <dt>{t('sales.done.tax', { type: receipt.taxType, rate: receipt.taxRate })}</dt>
            <dd className="text-right">{formatMoney(receipt.taxAmount)}</dd>
            <dt className="font-semibold">{t('sales.done.total')}</dt>
            <dd className="text-right font-semibold">{formatMoney(receipt.total)}</dd>
          </dl>
        </div>
      )}

      {branchId && (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Left: find products */}
          <div className="space-y-3">
            <BarcodeInput
              lookup={(code) => lookupProductByBarcode(code, branchId)}
              onFound={addToCart}
            />
            {notice && (
              <p role="status" className="text-sm text-red-600">
                {t(notice.key, notice.params)}
              </p>
            )}
            <ProductSearch branchId={branchId} onPick={addToCart} />
          </div>

          {/* Right: the cart */}
          <div className="bg-white border rounded p-4">
            <h2 className="font-semibold mb-2">{t('sales.cart.title')}</h2>

            {lines.length === 0 ? (
              <p className="text-sm text-gray-500 py-6">{t('sales.cart.empty')}</p>
            ) : (
              <ul>
                {lines.map((line) => (
                  <li key={line.product.id} className="flex items-center gap-3 py-3 border-b">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{line.product.name}</p>
                      <p className="text-xs text-gray-500">
                        {formatMoney(line.product.sellingPrice)} · {t('sales.stock', { qty: line.product.quantity })}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        aria-label={t('sales.cart.decrease')}
                        onClick={() => changeQuantity(line.product.id, line.quantity - 1)}
                        className="w-8 h-8 border rounded hover:bg-gray-100"
                      >
                        −
                      </button>
                      <input
                        type="number"
                        min="1"
                        max={line.product.quantity}
                        value={line.quantity}
                        onChange={(e) => changeQuantity(line.product.id, e.target.value)}
                        className="w-14 text-center border rounded py-1"
                      />
                      <button
                        type="button"
                        aria-label={t('sales.cart.increase')}
                        onClick={() => changeQuantity(line.product.id, line.quantity + 1)}
                        className="w-8 h-8 border rounded hover:bg-gray-100"
                      >
                        +
                      </button>
                    </div>
                    <div className="w-28 text-right font-medium">{formatMoney(line.lineTotal)}</div>
                    <button
                      type="button"
                      aria-label={t('sales.cart.remove')}
                      onClick={() => removeLine(line.product.id)}
                      className="w-8 h-8 text-gray-500 hover:text-red-600"
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <div className="flex items-baseline justify-between mt-4">
              <span className="text-lg font-semibold">{t('sales.cart.total')}</span>
              <span className="text-2xl font-bold text-brand">{formatMoney(total)}</span>
            </div>
            <p className="text-xs text-gray-500 mb-4">{t('sales.cart.priceIncludesTax')}</p>

            <label className="block text-sm mb-4">
              {t('sales.customer')}
              <input
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="mt-1 w-full border rounded px-3 py-2"
              />
            </label>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={completeSale}
                disabled={lines.length === 0 || submitting}
                className="flex-1 bg-brand text-white rounded px-4 py-3 font-medium hover:bg-brand-dark disabled:opacity-50"
              >
                {submitting ? t('sales.processing') : t('sales.complete')}
              </button>
              <button
                type="button"
                onClick={() => commitCart([])}
                disabled={lines.length === 0 || submitting}
                className="border rounded px-4 py-3 hover:bg-gray-100 disabled:opacity-50"
              >
                {t('sales.clear')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}