import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../auth/AuthContext'
import { api } from '../../lib/api'
import { Building2, Plus, Phone, MapPin } from 'lucide-react'

export default function BranchesList() {
  const { user } = useAuth()
  const { t, i18n } = useTranslation()
  const isAm = i18n.language === 'am'

  const [branches, setBranches] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [formData, setFormData] = useState({ name: '', code: '', address: '', phone: '' })
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    loadBranches()
  }, [])

  const loadBranches = () => {
    setLoading(true)
    api.get('/branches')
      .then((res) => setBranches(res.data || []))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false))
  }

  const handleCreate = async (e) => {
    e.preventDefault()
    if (!formData.name || !formData.code) return
    setSubmitting(true)
    try {
      await api.post('/branches', formData)
      setShowModal(false)
      setFormData({ name: '', code: '', address: '', phone: '' })
      loadBranches()
    } catch (err) {
      alert(err.message || 'Error creating branch')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            {t('nav.branches')}
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            {isAm ? 'የሱቆች እና መጋዘኖች ቅርንጫፎች ዝርዝር እና መረጃ' : 'Shops and central warehouses in the multi-branch network'}
          </p>
        </div>

        {user?.role === 'ADMIN' && (
          <button
            onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-blue-700 transition"
          >
            <Plus className="h-4 w-4" />
            {isAm ? 'አዲስ ቅርንጫፍ አክል' : 'Add Branch'}
          </button>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {loading ? (
          <div className="col-span-3 py-12 text-center text-xs text-slate-400">{t('common.loading')}</div>
        ) : branches.map((b) => (
          <div key={b.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-slate-900 text-sm">{b.name}</span>
                <span className="rounded-md bg-blue-50 px-2.5 py-0.5 text-[11px] font-mono font-bold text-blue-700 border border-blue-200">
                  {b.code}
                </span>
              </div>
              <div className="mt-4 space-y-2 text-xs text-slate-600">
                <div className="flex items-center gap-2">
                  <MapPin className="h-3.5 w-3.5 text-slate-400" />
                  <span>{b.address || 'Addis Ababa'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="h-3.5 w-3.5 text-slate-400" />
                  <span>{b.phone || '+251 911 000000'}</span>
                </div>
              </div>
            </div>
            <div className="mt-4 pt-3 border-t flex justify-between items-center text-[11px]">
              <span className="text-slate-400 font-medium">Branch ID: #{b.id}</span>
              <span className="font-bold text-emerald-600">Active</span>
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="font-extrabold text-base text-slate-900">{isAm ? 'አዲስ ቅርንጫፍ አክል' : 'Add Branch'}</h3>
            <form onSubmit={handleCreate} className="mt-4 space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">{isAm ? 'የቅርንጫፍ ስም' : 'Branch Name'} *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Merkato Branch (መርካቶ)"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">{isAm ? 'የቅርንጫፍ ኮድ' : 'Branch Code'} *</label>
                <input
                  type="text"
                  required
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  placeholder="e.g. MRK, BOLE, HAW"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">{isAm ? 'አድራሻ' : 'Address'}</label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="e.g. Merkato, Addis Ababa"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">{isAm ? 'ስልክ' : 'Phone'}</label>
                <input
                  type="text"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+251 911 000000"
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
