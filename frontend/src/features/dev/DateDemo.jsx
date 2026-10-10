import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import EthiopianDatePicker from '../../components/EthiopianDatePicker'
import { formatNow, useFormatDate } from '../../lib/dateFormat'

// Timestamps as the API sends them (UTC). Expected Ethiopia-time results are in the README of this step.
const SAMPLES = ['2026-10-09T21:30:00Z', '2026-10-05T09:30:00Z', '2023-09-11T12:00:00Z']

export default function DateDemo() {
  const { t } = useTranslation()
  const formatDate = useFormatDate()
  const [value, setValue] = useState('')

  return (
    <div className="max-w-xl space-y-6">
      <h1 className="text-2xl font-semibold">Date tools (dev only)</h1>

      <section>
        <h2 className="font-medium mb-1">Now (Ethiopia time)</h2>
        <p>{formatNow(t, { withTime: true })}</p>
      </section>

      <section>
        <h2 className="font-medium mb-1">UTC timestamp to Ethiopia time</h2>
        <ul className="text-sm space-y-1">
          {SAMPLES.map((s) => (
            <li key={s}>
              <code>{s}</code> to <strong>{formatDate(s, { withTime: true })}</strong>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="font-medium mb-1">Date picker</h2>
        <EthiopianDatePicker value={value} onChange={setValue} />
        <p className="text-sm mt-2">
          Value sent to the API: <code>{value || '(empty)'}</code>
        </p>
        <p className="text-sm">
          Shown back: <strong>{formatDate(value) || '(empty)'}</strong>
        </p>
        <button onClick={() => setValue('')} className="mt-2 text-sm text-brand underline">
          Clear
        </button>
      </section>
    </div>
  )
}