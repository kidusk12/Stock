import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import EthiopianDatePicker from '../../components/EthiopianDatePicker'
import { formatNow, useFormatDate } from '../../lib/dateFormat'
import { useFormatBirr } from '../../lib/money'

// Timestamps as the API sends them (UTC). Expected Ethiopia-time results are in the README of this step.
const SAMPLES = ['2026-10-09T21:30:00Z', '2026-10-05T09:30:00Z', '2023-09-11T12:00:00Z']

export default function DateDemo() {
  const { t } = useTranslation()
  const formatMoney = useFormatBirr()
  const [amount, setAmount] = useState('1150')
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

      <section>
        <h2 className="font-medium mb-1">Birr</h2>
        <ul className="text-sm space-y-1">
            {[1150, 0.1 + 0.2, 1234567.891, -50, 1.005, null].map((v, i) => (
                <li key={i}>
                    <code>{String(v)}</code> to <strong>{formatMoney(v) || '(empty)'}</strong>
                </li>
            ))}
        </ul>
        <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="border rounded px-2 py-1 mt-2 text-sm"
        />
        <span className="text-sm ml-2">
            <strong>{formatMoney(amount) || '(empty)'}</strong>
        </span>
    </section>
    </div>
  )
}