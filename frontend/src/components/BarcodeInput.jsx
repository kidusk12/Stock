import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { errorKey } from '../lib/errorMessages'

// Props:
//   lookup(code)    async function that returns the product, or throws an ApiError
//   onFound(product) called with the product after a successful lookup
//   keepFocus       take the focus back if it falls on nothing (default true)
export default function BarcodeInput({ lookup, onFound, keepFocus = true }) {
  const { t } = useTranslation()
  const inputRef = useRef(null)
  const [value, setValue] = useState('')
  const [status, setStatus] = useState(null) // { type: 'success' | 'error', key, params }

  // The message disappears after a few seconds
  useEffect(() => {
    if (!status) return
    const id = setTimeout(() => setStatus(null), 4000)
    return () => clearTimeout(id)
  }, [status])

  const handleSubmit = async (e) => {
    e.preventDefault() // a scanner's Enter would otherwise reload the page
    const code = value.trim()
    if (!code) return

    // Clear the box right away. The input is never disabled while we wait, because a
    // disabled input loses focus and swallows the next scan.
    setValue('')
    inputRef.current?.focus()

    let product
    try {
      product = await lookup(code)
    } catch (err) {
      if (err?.code === 'PRODUCT_NOT_FOUND') {
        setStatus({ type: 'error', key: 'barcode.notFound', params: { code } })
      } else {
        setStatus({ type: 'error', key: errorKey(err), params: {} })
      }
      return
    }

    setStatus({ type: 'success', key: 'barcode.found', params: { name: product.name } })
    onFound(product)
  }

  // Scanners type into whatever has focus. If focus fell onto nothing, take it back,
  // but never steal it from another input, select or button.
  const handleBlur = () => {
    setTimeout(() => {
      const active = document.activeElement
      if (!active || active === document.body) inputRef.current?.focus()
    }, 0)
  }

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <label htmlFor="barcode-input" className="sr-only">
        {t('barcode.label')}
      </label>
      <input
        id="barcode-input"
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={keepFocus ? handleBlur : undefined}
        placeholder={t('barcode.placeholder')}
        autoFocus
        autoComplete="off"
        spellCheck={false}
        className="w-full border-2 border-brand rounded px-4 py-3 text-lg"
      />
      <p
        role="status"
        aria-live="polite"
        className={`mt-2 min-h-6 text-sm ${status?.type === 'error' ? 'text-red-600' : 'text-green-700'}`}
      >
        {status ? t(status.key, status.params) : ''}
      </p>
    </form>
  )
}