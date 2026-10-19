import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  apiDateToEthiopian,
  daysInEthiopianMonth,
  ethiopianToApiDate,
  todayEthiopian,
} from '../lib/ethiopianDate'

const toParts = (value) => {
  const e = apiDateToEthiopian(value)
  return e ? { day: e.day, month: e.month, year: e.year } : { day: '', month: '', year: '' }
}

const selectClass = 'border rounded px-2 py-1.5 text-sm bg-white'

// value / onChange use a Gregorian 'YYYY-MM-DD' string (what the API wants), or '' when empty.
// The user picks day, month and year in the Ethiopian calendar.
export default function EthiopianDatePicker({ value = '', onChange, yearsBack = 10, yearsForward = 1 }) {
  const { t } = useTranslation()
  const [parts, setParts] = useState(() => toParts(value))
  const [prevValue, setPrevValue] = useState(value)
  const [lastEmitted, setLastEmitted] = useState(value)

  // If the parent changes the value (for example a "clear filters" button), follow it.
  if (value !== prevValue) {
    setPrevValue(value)
    if (value !== lastEmitted) setParts(toParts(value))
  }

  const update = (field, raw) => {
    const next = { ...parts, [field]: raw === '' ? '' : Number(raw) }
    // Keep the day valid when the month or year changes (Pagume has 5 or 6 days)
    if (next.day !== '' && next.month !== '' && next.year !== '') {
      next.day = Math.min(next.day, daysInEthiopianMonth(next.year, next.month))
    }
    const complete = next.day !== '' && next.month !== '' && next.year !== ''
    const out = complete ? ethiopianToApiDate(next.year, next.month, next.day) : ''
    setParts(next)
    setLastEmitted(out)
    onChange?.(out)
  }

  const currentYear = todayEthiopian().year
  const years = []
  for (let y = currentYear + yearsForward; y >= currentYear - yearsBack; y--) years.push(y)
  if (parts.year !== '' && !years.includes(parts.year)) years.push(parts.year)
  years.sort((a, b) => b - a)

  const maxDay = parts.month === '' ? 30 : daysInEthiopianMonth(parts.year === '' ? currentYear : parts.year, parts.month)

  return (
    <div className="flex gap-2" role="group">
      <select
        aria-label={t('calendar.day')}
        value={parts.day}
        onChange={(e) => update('day', e.target.value)}
        className={selectClass}
      >
        <option value="">{t('calendar.day')}</option>
        {Array.from({ length: maxDay }, (_, i) => i + 1).map((d) => (
          <option key={d} value={d}>
            {d}
          </option>
        ))}
      </select>

      <select
        aria-label={t('calendar.month')}
        value={parts.month}
        onChange={(e) => update('month', e.target.value)}
        className={selectClass}
      >
        <option value="">{t('calendar.month')}</option>
        {Array.from({ length: 13 }, (_, i) => i + 1).map((m) => (
          <option key={m} value={m}>
            {t(`calendar.months.${m}`)}
          </option>
        ))}
      </select>

      <select
        aria-label={t('calendar.year')}
        value={parts.year}
        onChange={(e) => update('year', e.target.value)}
        className={selectClass}
      >
        <option value="">{t('calendar.year')}</option>
        {years.map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </select>
    </div>
  )
}