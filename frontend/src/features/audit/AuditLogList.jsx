import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { api } from '../../lib/api'
import { formatDate } from '../../lib/ethiopianDate'
import { ShieldCheck, Search, Clock, User, Building2 } from 'lucide-react'

export default function AuditLogList() {
  const { t, i18n } = useTranslation()
  const isAm = i18n.language === 'am'

  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')

  useEffect(() => {
    loadLogs()
  }, [])

  const loadLogs = () => {
    setLoading(true)
    api.get('/audit-logs')
      .then((res) => setLogs(res.data || []))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false))
  }

  const filtered = logs.filter(
    (l) =>
      !query ||
      [l.user, l.action, l.details, l.branch].some((v) =>
        String(v).toLowerCase().includes(query.toLowerCase())
      )
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-blue-100 text-blue-800">
              <ShieldCheck className="h-5 w-5" />
            </span>
            {t('audit.title')}
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            {isAm
              ? 'ማንም ሰው ሊለውጠው ወይም ሊሰርዘው የማይችል ቋሚ የክንውኖች መዝገብ'
              : 'Permanent append-only audit trail of system activities and data mutations'}
          </p>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('common.search')}
            className="w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 py-2 text-xs focus:border-blue-500 focus:outline-none"
          />
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-soft overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase text-[11px] font-bold">
              <tr>
                <th className="py-3 px-4">{t('audit.timestamp')}</th>
                <th className="py-3 px-4">{t('audit.user')}</th>
                <th className="py-3 px-4">{t('audit.action')}</th>
                <th className="py-3 px-4">{isAm ? 'ቅርንጫፍ' : 'Branch'}</th>
                <th className="py-3 px-4">{t('audit.details')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
              {loading ? (
                <tr>
                  <td colSpan="5" className="py-8 text-center text-slate-400">{t('common.loading')}</td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan="5" className="py-8 text-center text-slate-400">{t('common.noData')}</td>
                </tr>
              ) : (
                filtered.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/70">
                    <td className="py-3 px-4 text-slate-500 whitespace-nowrap">
                      {formatDate(log.timestamp, i18n.language)}
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-900">{log.user}</td>
                    <td className="py-3 px-4">
                      <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold font-mono text-blue-800 border border-slate-200">
                        {log.action}
                      </span>
                    </td>
                    <td className="py-3 px-4">{log.branch}</td>
                    <td className="py-3 px-4 text-slate-600 max-w-md">{log.details}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
