import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../auth/AuthContext'
import { api } from '../../lib/api'
import { Settings, Save, CheckCircle2 } from 'lucide-react'

export default function SettingsView() {
  const { user } = useAuth()
  const { t, i18n } = useTranslation()
  const isAm = i18n.language === 'am'

  const [settings, setSettings] = useState({
    companyName: '',
    address: '',
    phone: '',
    tin: '',
    taxType: 'VAT',
    taxRate: 15,
  })
  const [loading, setLoading] = useState(true)
  const [savedMsg, setSavedMsg] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    api.get('/settings/company')
      .then((res) => {
        if (res) setSettings(res)
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false))
  }, [])

  const handleSave = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    setSavedMsg(false)
    try {
      await api.put('/settings/company', {
        companyName: settings.companyName, address: settings.address || null, phone: settings.phone || null,
        tin: settings.tin || null, taxType: settings.taxType, taxRate: Number(settings.taxRate),
      })
      setSavedMsg(true)
      setTimeout(() => setSavedMsg(false), 4000)
    } catch (err) {
      alert(err.message || 'Error saving settings')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
          {t('settings.title')}
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          {isAm ? 'በደረሰኞች ላይ የሚታተም የድርጅት መረጃ እና የግብር ሥርዓት' : 'Company profile and tax regulations configured for printed invoices'}
        </p>
      </div>

      {savedMsg && (
        <div className="flex items-center gap-2 rounded-xl bg-emerald-50 p-3.5 text-xs font-bold text-emerald-800 border border-emerald-200">
          <CheckCircle2 className="h-4 w-4" />
          <span>{t('settings.saveSuccess')}</span>
        </div>
      )}

      <form onSubmit={handleSave} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-soft space-y-4 text-xs">
        <div>
          <label className="block font-bold text-slate-700 mb-1">{t('settings.companyName')} *</label>
          <input
            type="text"
            required
            value={settings.companyName || ''}
            onChange={(e) => setSettings({ ...settings, companyName: e.target.value })}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="block font-bold text-slate-700 mb-1">{t('settings.address')}</label>
          <input
            type="text"
            value={settings.address || ''}
            onChange={(e) => setSettings({ ...settings, address: e.target.value })}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block font-bold text-slate-700 mb-1">{t('settings.phone')}</label>
            <input
              type="text"
              value={settings.phone || ''}
              onChange={(e) => setSettings({ ...settings, phone: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">{t('settings.tin')}</label>
            <input
              type="text"
              value={settings.tin || ''}
              onChange={(e) => setSettings({ ...settings, tin: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-blue-500 focus:outline-none font-mono"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 pt-2 border-t">
          <div>
            <label className="block font-bold text-slate-700 mb-1">{t('settings.taxType')}</label>
            <select
              value={settings.taxType || 'VAT'}
              onChange={(e) => {
                const type = e.target.value
                setSettings({
                  ...settings,
                  taxType: type,
                  taxRate: type === 'VAT' ? 15 : 2,
                })
              }}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-blue-500 focus:outline-none font-bold"
            >
              <option value="VAT">VAT (15%)</option>
              <option value="TOT">Turnover Tax - TOT (2%)</option>
            </select>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">{t('settings.taxRate')}</label>
            <input
              type="number"
              step="0.01"
              value={settings.taxRate ?? (settings.taxType === 'TOT' ? 2 : 15)}
              disabled
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 focus:outline-none font-bold text-slate-600"
            />
          </div>
        </div>

        {user?.role === 'ADMIN' && (
          <div className="pt-4 flex justify-end">
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-blue-700 transition disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {submitting ? t('common.loading') : t('common.save')}
            </button>
          </div>
        )}
      </form>
    </div>
  )
}
