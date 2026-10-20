import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { api } from '../../lib/api'
import { CheckCircle2, Save } from 'lucide-react'

const EMPTY_SETTINGS = {
  companyName: '',
  address: '',
  phone: '',
  tin: '',
  taxType: 'VAT',
  taxRate: 15,
  defaultTaxRates: { VAT: 15, TOT: 2 },
}

export default function SettingsView() {
  const { t } = useTranslation()
  const [settings, setSettings] = useState(EMPTY_SETTINGS)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [saveError, setSaveError] = useState('')
  const [savedMsg, setSavedMsg] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const loadSettings = useCallback(async () => {
    setLoading(true)
    setLoadError('')
    try {
      const result = await api.get('/settings/company')
      setSettings({
        ...EMPTY_SETTINGS,
        ...result,
        defaultTaxRates: result?.defaultTaxRates || EMPTY_SETTINGS.defaultTaxRates,
      })
    } catch (err) {
      setLoadError(t(`errors.${err.code}`, { defaultValue: t('settings.loadError') }))
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => { loadSettings() }, [loadSettings])

  const handleTaxTypeChange = (taxType) => {
    setSettings((current) => ({
      ...current,
      taxType,
      taxRate: current.defaultTaxRates?.[taxType] ?? (taxType === 'VAT' ? 15 : 2),
    }))
  }

  const handleSave = async (event) => {
    event.preventDefault()
    setSubmitting(true)
    setSavedMsg(false)
    setSaveError('')
    try {
      const { companyName, address, phone, tin, taxType, taxRate } = settings
      const result = await api.put('/settings/company', {
        companyName: companyName.trim(),
        address: address || '',
        phone: phone || '',
        tin: tin || '',
        taxType,
        taxRate: Number(taxRate),
      })
      setSettings((current) => ({
        ...current,
        ...result,
        defaultTaxRates: result?.defaultTaxRates || current.defaultTaxRates,
      }))
      setSavedMsg(true)
    } catch (err) {
      setSaveError(t(`errors.${err.code}`, { defaultValue: t('settings.saveError') }))
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return <p className="text-sm text-slate-500" role="status">{t('common.loading')}</p>
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">{t('settings.title')}</h1>
        <p className="mt-1 text-sm text-slate-500">{t('settings.description')}</p>
      </div>

      {loadError && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800" role="alert">
          <p>{loadError}</p>
          <button type="button" onClick={loadSettings} className="mt-2 font-bold underline">{t('common.retry')}</button>
        </div>
      )}

      {!loadError && (
        <form onSubmit={handleSave} className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-soft">
          {savedMsg && (
            <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-sm font-semibold text-emerald-800" role="status">
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              <span>{t('settings.saveSuccess')}</span>
            </div>
          )}
          {saveError && <div className="rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm text-red-800" role="alert">{saveError}</div>}

          <div>
            <label htmlFor="company-name" className="mb-1 block text-sm font-bold text-slate-700">{t('settings.companyName')} *</label>
            <input id="company-name" name="companyName" type="text" required maxLength={150} autoComplete="organization"
              value={settings.companyName || ''} onChange={(e) => setSettings((s) => ({ ...s, companyName: e.target.value }))}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-100" />
          </div>

          <div>
            <label htmlFor="company-address" className="mb-1 block text-sm font-bold text-slate-700">{t('settings.address')}</label>
            <input id="company-address" name="address" type="text" autoComplete="street-address"
              value={settings.address || ''} onChange={(e) => setSettings((s) => ({ ...s, address: e.target.value }))}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-100" />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="company-phone" className="mb-1 block text-sm font-bold text-slate-700">{t('settings.phone')}</label>
              <input id="company-phone" name="phone" type="tel" autoComplete="tel" value={settings.phone || ''}
                onChange={(e) => setSettings((s) => ({ ...s, phone: e.target.value }))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-100" />
            </div>
            <div>
              <label htmlFor="company-tin" className="mb-1 block text-sm font-bold text-slate-700">{t('settings.tin')}</label>
              <input id="company-tin" name="tin" type="text" maxLength={20} value={settings.tin || ''}
                onChange={(e) => setSettings((s) => ({ ...s, tin: e.target.value }))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-100" />
            </div>
          </div>

          <div className="grid gap-4 border-t border-slate-100 pt-5 sm:grid-cols-2">
            <div>
              <label htmlFor="tax-type" className="mb-1 block text-sm font-bold text-slate-700">{t('settings.taxType')}</label>
              <select id="tax-type" name="taxType" value={settings.taxType || 'VAT'} onChange={(e) => handleTaxTypeChange(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 font-semibold focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-100">
                <option value="VAT">{t('settings.vatOption', { rate: settings.defaultTaxRates?.VAT ?? 15 })}</option>
                <option value="TOT">{t('settings.totOption', { rate: settings.defaultTaxRates?.TOT ?? 2 })}</option>
              </select>
            </div>
            <div>
              <label htmlFor="tax-rate" className="mb-1 block text-sm font-bold text-slate-700">{t('settings.taxRate')}</label>
              <div className="relative">
                <input id="tax-rate" name="taxRate" type="number" min="0" max="100" step="0.01" required
                  value={settings.taxRate ?? ''} onChange={(e) => setSettings((s) => ({ ...s, taxRate: e.target.value }))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 pr-9 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-100" />
                <span className="absolute right-3 top-2 text-slate-500" aria-hidden="true">%</span>
              </div>
            </div>
          </div>

          <div className="flex justify-end border-t border-slate-100 pt-5">
            <button type="submit" disabled={submitting}
              className="inline-flex items-center gap-2 rounded-xl bg-teal-700 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50">
              <Save className="h-4 w-4" aria-hidden="true" />
              {submitting ? t('common.loading') : t('common.save')}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
