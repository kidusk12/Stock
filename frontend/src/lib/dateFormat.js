import { useTranslation } from 'react-i18next'
import { apiDateToEthiopian, toEthiopiaTime } from './ethiopianDate'

const pad2 = (n) => String(n).padStart(2, '0')

// value can be:
//   an API timestamp ("2026-10-05T09:30:00Z") or a Date: shown in Ethiopia time (UTC+3)
//   a date-only string ("2026-10-05"): that day in Ethiopia time, no shifting
// Result: "Meskerem 25, 2019" (or "መስከረም 25, 2019"), plus " 12:30" if withTime.
export function formatEthiopianDate(value, t, { withTime = false } = {}) {
  if (!value) return ''

  let ethiopian = null
  let hour = null
  let minute = null

  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    ethiopian = apiDateToEthiopian(value)
  } else {
    const parts = toEthiopiaTime(value)
    if (parts) {
      ethiopian = parts.ethiopian
      hour = parts.hour
      minute = parts.minute
    }
  }
  if (!ethiopian) return ''

  const text = `${t(`calendar.months.${ethiopian.month}`)} ${ethiopian.day}, ${ethiopian.year}`
  return withTime && hour !== null ? `${text} ${pad2(hour)}:${pad2(minute)}` : text
}

// For the current moment (kept here so components don't call new Date() while rendering)
export const formatNow = (t, options) => formatEthiopianDate(new Date(), t, options)

// In components:  const formatDate = useFormatDate();  formatDate(row.createdAt, { withTime: true })
export function useFormatDate() {
  const { t } = useTranslation()
  return (value, options) => formatEthiopianDate(value, t, options)
}