import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../auth/AuthContext'
import { api } from '../../lib/api'
import { Users, Plus, Phone, Mail, MapPin } from 'lucide-react'

export default function SuppliersList() {
  const { user } = useAuth()
  const { t, i18n } = useTranslation()
  const isAm = i18n.language === 'am'

  const [suppliers, setSuppliers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [formData, setFormData] = useState({ name: '', contact: '', phone: '', tin: '', address: '' })
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    loadSuppliers()
  }, [])

  const loadSuppliers = () => {
    setLoading(true)
    api.get('/suppliers')
      .then((res) => setSuppliers(res.data || []))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false))
  }

  const handleCreate = async (e) => {
    e.preventDefault()
    if (!formData.name) return
    setSubmitting(true)
    try {
      await api.post('/suppliers', formData)
      setShowModal(false)
      setFormData({ name: '', contact: '', phone: '', tin: '', address: '' })
      loadSuppliers()
    } catch (err) {
      alert(err.message || 'Error creating supplier')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            {t('nav.suppliers')}
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            {isAm ? 'የዕቃ አቅራቢዎች አድራሻ፣ ስልክ እና የግብር ከፋይ ቁጥር (TIN)' : 'Supplier directory, contacts, address, and TIN'}
          </p>
        </div>

        {(user?.role === 'ADMIN' || user?.role === 'BRANCH_MANAGER') && (
          <button
            onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-blue-700 transition"
          >
            <Plus className="h-4 w-4" />
            {isAm ? 'አዲስ አቅራቢ አክል' : 'Add Supplier'}
          </button>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {loading ? (
          <div className="col-span-3 py-12 text-center text-xs text-slate-400">{t('common.loading')}</div>
        ) : suppliers.map((s) => (
          <div key={s.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-slate-900 text-sm">{s.name}</span>
                <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200">
                  Active
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium mt-1">
                {isAm ? 'ተጠሪ:' : 'Contact:'} {s.contact}
              </p>
              <div className="mt-4 space-y-2 text-xs text-slate-600">
                <div className="flex items-center gap-2">
                  <Phone className="h-3.5 w-3.5 text-slate-400" />
                  <span>{s.phone}</span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="h-3.5 w-3.5 text-slate-400" />
                  <span>{s.address}</span>
                </div>
                <div className="text-[11px] font-mono text-slate-500 font-semibold">
                  TIN: {s.tin}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="font-extrabold text-base text-slate-900">{isAm ? 'አዲስ አቅራቢ አክል' : 'Add Supplier'}</h3>
            <form onSubmit={handleCreate} className="mt-4 space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">{isAm ? 'የድርጅት/አቅራቢ ስም' : 'Supplier Name'} *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Al-Sam PLC"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">{isAm ? 'ተጠሪ ሰው' : 'Contact Person'}</label>
                <input
                  type="text"
                  value={formData.contact}
                  onChange={(e) => setFormData({ ...formData, contact: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">{isAm ? 'ስልክ' : 'Phone'}</label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">TIN #</label>
                  <input
                    type="text"
                    value={formData.tin}
                    onChange={(e) => setFormData({ ...formData, tin: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">{isAm ? 'አድራሻ' : 'Address'}</label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="rounded-xl border border-slate-300 px-4 py-2 font-bold text-slate-600 hover:bg-slate-50"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-xl bg-blue-600 px-5 py-2 font-bold text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {t('common.save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
