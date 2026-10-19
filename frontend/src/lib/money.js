import { useTranslation } from 'react-i18next'

// Always Western digits and comma grouping, even when the UI is in Amharic
// (same choice as dates: 1,150.00, not Ethiopic numerals).
const numberFormat = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const NBSP = '\u00A0' // keeps the currency and the amount on the same line

// Round to 2 decimals without floating-point surprises.
// 1.005 -> 1.01, 0.1 + 0.2 -> 0.3, -2.675 -> -2.68
export function roundMoney(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return NaN
  const sign = n < 0 ? -1 : 1
  const abs = Math.abs(n)
  if (abs >= Number.MAX_SAFE_INTEGER / 100) return n // too large to round safely (not a real amount)
  const text = String(abs)
  // Shifting the decimal point in text avoids binary rounding errors.
  // (Very small numbers print with "e", so use plain math for those.)
  const cents = text.includes('e') ? Math.round(abs * 100) : Math.round(Number(`${text}e2`))
  return (sign * cents) / 100
}

// formatBirr(1150, t)                      -> "ETB 1,150.00"  /  "ብር 1,150.00"
// formatBirr(1150, t, { symbol: false })   -> "1,150.00"  (for table columns whose header says ETB)
// formatBirr(null, t)                      -> ""  (nothing to show)
export function formatBirr(value, t, { symbol = true } = {}) {
  if (value === null || value === undefined || value === '') return ''
  const rounded = roundMoney(value)
  if (!Number.isFinite(rounded)) return ''
  const sign = rounded < 0 ? '-' : ''
  const number = numberFormat.format(Math.abs(rounded))
  return symbol ? `${sign}${t('money.currency')}${NBSP}${number}` : `${sign}${number}`
}

// In components:  const formatMoney = useFormatBirr();  formatMoney(product.sellingPrice)
export function useFormatBirr() {
  const { t } = useTranslation()
  return (value, options) => formatBirr(value, t, options)
}