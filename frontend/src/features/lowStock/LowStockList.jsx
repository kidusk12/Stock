import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../auth/AuthContext'
import { api } from '../../lib/api'
import {
  AlertTriangle,
  ShoppingCart,
  Building2,
  PackageCheck,
  CheckCircle2,
  ArrowRight
} from 'lucide-react'

export default function LowStockList() {
  const { user, selectedBranchId } = useAuth()
  const { t, i18n } = useTranslation()
  const isAm = i18n.language === 'am'

  const [lowStockItems, setLowStockItems] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadLowStock()
  }, [selectedBranchId])

  const loadLowStock = () => {
    setLoading(true)
    api.get('/low-stock', { branchId: selectedBranchId })
      .then((res) => {
        setLowStockItems((res.data || []).map((item) => ({ ...item, id: `${item.productId}_${item.branchId}`, name: item.productName })))
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false))
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-amber-100 text-amber-700">
              <AlertTriangle className="h-5 w-5" />
            </span>
            {t('lowStock.title')}
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            {isAm
              ? 'ከዝቅተኛው የክምችት ገደብ በታች ያሉ ምርቶች እና የሚመከር የትዕዛዝ መጠን'
              : 'Products currently below their safety threshold and calculated reorder suggestions'}
          </p>
        </div>

        <Link
          to="/purchases"
          className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-blue-700 transition"
        >
          <ShoppingCart className="h-4 w-4" />
          {t('lowStock.createPo')}
        </Link>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-soft overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase text-[11px] font-bold">
              <tr>
                <th className="py-3 px-4">{t('products.name')}</th>
                <th className="py-3 px-4">{t('products.sku')}</th>
                <th className="py-3 px-4">{t('adjustments.branch')}</th>
                <th className="py-3 px-4 text-center">{t('lowStock.currentStock')}</th>
                <th className="py-3 px-4 text-center">{t('lowStock.minLevel')}</th>
                <th className="py-3 px-4 text-center">{t('lowStock.maxLevel')}</th>
                <th className="py-3 px-4 text-center text-blue-700">{t('lowStock.reorderQty')}</th>
                <th className="py-3 px-4 text-center">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
              {loading ? (
                <tr>
                  <td colSpan="8" className="py-8 text-center text-slate-400">
                    {t('common.loading')}
                  </td>
                </tr>
              ) : lowStockItems.length === 0 ? (
                <tr>
                  <td colSpan="8" className="py-12 text-center text-slate-400">
                    <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-500 mb-2" />
                    <span className="font-bold text-slate-700">
                      {isAm ? 'ሁሉም ምርቶች ከዝቅተኛው ገደብ በላይ በደህና ይገኛሉ!' : 'All products have adequate stock levels!'}
                    </span>
                  </td>
                </tr>
              ) : (
                lowStockItems.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/70">
                    <td className="py-3 px-4 font-bold text-slate-900">{item.name}</td>
                    <td className="py-3 px-4 font-mono text-slate-600 text-[11px]">{item.sku}</td>
                    <td className="py-3 px-4">{item.branchName}</td>
                    <td className="py-3 px-4 text-center">
                      <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-red-100 text-red-800">
                        {item.quantity} {item.unit}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center font-bold text-slate-600">{item.minQuantity}</td>
                    <td className="py-3 px-4 text-center text-slate-500">{item.maxQuantity || 'None'}</td>
                    <td className="py-3 px-4 text-center">
                      <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-blue-50 text-blue-800 border border-blue-200">
                        +{item.suggestedReorder} {item.unit}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <Link
                        to="/purchases"
                        className="inline-flex items-center gap-1 rounded-lg bg-blue-50 px-2.5 py-1 text-[11px] font-bold text-blue-700 hover:bg-blue-100 transition"
                      >
                        <ShoppingCart className="h-3 w-3" />
                        {isAm ? 'አሁን እዘዝ' : 'Order Now'}
                      </Link>
                    </td>
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
