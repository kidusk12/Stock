import { useState, useEffect, useRef, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../auth/AuthContext'
import { api } from '../../lib/api'
import { formatDate, toEthiopiaTime } from '../../lib/ethiopianDate'
import { ShieldCheck, ChevronDown, ChevronRight } from 'lucide-react'

const PAGE_SIZE = 20

const ENTITY_TYPES = ['USER', 'PRODUCT', 'SUPPLIER', 'BRANCH', 'PO', 'SALE', 'RETURN', 'ADJUSTMENT', 'TRANSFER', 'IMPORT']

const ACTIONS = [
  'USER_CREATED', 'USER_UPDATED', 'USER_LOGOUT',
  'PRODUCT_CREATED', 'PRODUCT_UPDATED', 'PRICE_CHANGED',
  'SUPPLIER_UPDATED', 'BRANCH_UPDATED',
  'PO_CREATED', 'PO_APPROVED', 'PO_REJECTED', 'PO_RECEIVED',
  'SALE_CREATED', 'RETURN_CREATED', 'RETURN_REFUNDED', 'ADJUSTMENT_CREATED',
  'TRANSFER_REQUESTED', 'TRANSFER_APPROVED', 'TRANSFER_REJECTED', 'TRANSFER_SHIPPED', 'TRANSFER_RECEIVED',
  'IMPORT_CONFIRMED',
]

const EMPTY_FILTERS = { userId: '', entityType: '', entityId: '', action: '', productText: '', from: '', to: '' }

const pad = (n) => String(n).padStart(2, '0')

function formatDateTime(value, lang) {
  const date = formatDate(value, lang)
  const local = toEthiopiaTime(value)
  return local ? `${date}, ${pad(local.hour)}:${pad(local.minute)}` : date
}

const asObject = (v) =>
  v && typeof v === 'object' && !Array.isArray(v) ? v : v === null || v === undefined ? {} : { value: v }

const showValue = (v) =>
  v === null || v === undefined ? '—' : typeof v === 'object' ? JSON.stringify(v) : String(v)

function changedFields(oldValue, newValue) {
  const before = asObject(oldValue)
  const after = asObject(newValue)
  return [...new Set([...Object.keys(before), ...Object.keys(after)])].map((key) => ({
    key,
    before: before[key],
    after: after[key],
  }))
}

export default function AuditLogList() {
  const { t, i18n } = useTranslation()
  const { user, selectedBranchId } = useAuth()
  const canPickBranch = user?.role === 'ADMIN' || user?.role === 'AUDITOR'

  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [errorCode, setErrorCode] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)

  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [filterError, setFilterError] = useState('')
  const appliedRef = useRef({ userId: '', entityType: '', entityId: '', action: '', productId: '', from: '', to: '' })

  const [knownUsers, setKnownUsers] = useState({})
  const [productOptions, setProductOptions] = useState([])
  const [expanded, setExpanded] = useState(() => new Set())
  const requestRef = useRef(0)

  const load = useCallback((nextPage, active) => {
    const requestId = ++requestRef.current
    setLoading(true)
    setErrorCode('')
    api
      .get('/audit-logs', {
        branchId: canPickBranch ? selectedBranchId || undefined : undefined,
        userId: active.userId || undefined,
        entityType: active.entityType || undefined,
        entityId: active.entityId || undefined,
        action: active.action || undefined,
        productId: active.productId || undefined,
        from: active.from || undefined,
        to: active.to || undefined,
        page: nextPage,
        limit: PAGE_SIZE,
      })
      .then((res) => {
        if (requestId !== requestRef.current) return
        const rows = Array.isArray(res?.data) ? res.data : []
        setLogs(rows)
        setPage(res?.page || nextPage)
        setTotal(Number(res?.total) || 0)
        setExpanded(new Set())
        setKnownUsers((prev) => {
          const next = { ...prev }
          rows.forEach((r) => {
            if (r.createdBy?.id) next[r.createdBy.id] = r.createdBy.name
          })
          return next
        })
      })
      .catch((err) => {
        if (requestId !== requestRef.current) return
        setLogs([])
        setTotal(0)
        setErrorCode(err?.code || 'UNKNOWN')
      })
      .finally(() => {
        if (requestId === requestRef.current) setLoading(false)
      })
  }, [canPickBranch, selectedBranchId])

  // Reload (from page 1) when the header branch changes.
  useEffect(() => {
    load(1, appliedRef.current)
  }, [load])

  // Admin can list every user for the user filter.
  useEffect(() => {
    if (user?.role !== 'ADMIN') return
    api
      .get('/users', { limit: 100, includeInactive: true })
      .then((res) => {
        const rows = Array.isArray(res?.data) ? res.data : []
        setKnownUsers((prev) => {
          const next = { ...prev }
          rows.forEach((u) => { next[u.id] = u.fullName })
          return next
        })
      })
      .catch(() => {})
  }, [user?.role])

  // Product filter: search as the user types.
  useEffect(() => {
    const text = filters.productText.trim()
    if (text.length < 2 || productOptions.some((o) => o.label === filters.productText)) return
    const timer = setTimeout(() => {
      api
        .get('/products', { q: text, limit: 10 })
        .then((res) => {
          const rows = Array.isArray(res?.data) ? res.data : []
          setProductOptions(rows.map((p) => ({ id: p.id, label: `${p.name} (${p.sku})` })))
        })
        .catch(() => setProductOptions([]))
    }, 250)
    return () => clearTimeout(timer)
  }, [filters.productText, productOptions])

  const setFilter = (key) => (event) => setFilters((prev) => ({ ...prev, [key]: event.target.value }))

  const applyFilters = (event) => {
    event.preventDefault()
    setFilterError('')
    let productId = ''
    if (filters.productText.trim()) {
      const match = productOptions.find((o) => o.label === filters.productText)
      if (!match) {
        setFilterError(t('audit.productPick'))
        return
      }
      productId = String(match.id)
    }
    appliedRef.current = {
      userId: filters.userId,
      entityType: filters.entityType,
      entityId: filters.entityId,
      action: filters.action,
      productId,
      from: filters.from,
      to: filters.to,
    }
    load(1, appliedRef.current)
  }

  const clearFilters = () => {
    setFilters(EMPTY_FILTERS)
    setFilterError('')
    appliedRef.current = { userId: '', entityType: '', entityId: '', action: '', productId: '', from: '', to: '' }
    load(1, appliedRef.current)
  }

  const toggleRow = (id) =>
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const userOptions = Object.entries(knownUsers).sort((a, b) => a[1].localeCompare(b[1]))
  const inputClass = 'mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm'

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-blue-100 text-blue-800">
            <ShieldCheck className="h-5 w-5" />
          </span>
          {t('audit.title')}
        </h1>
        <p className="text-xs text-slate-500 mt-1">{t('audit.description')}</p>
      </div>

      <form onSubmit={applyFilters} className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-xs font-bold text-slate-700">
          {t('audit.user')}
          <select value={filters.userId} onChange={setFilter('userId')} className={inputClass}>
            <option value="">{t('audit.allUsers')}</option>
            {userOptions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </select>
        </label>
        <label className="text-xs font-bold text-slate-700">
          {t('audit.action')}
          <select value={filters.action} onChange={setFilter('action')} className={inputClass}>
            <option value="">{t('audit.allActions')}</option>
            {ACTIONS.map((a) => <option key={a} value={a}>{t(`audit.actions.${a}`, { defaultValue: a })}</option>)}
          </select>
        </label>
        <label className="text-xs font-bold text-slate-700">
          {t('audit.entity')}
          <select value={filters.entityType} onChange={setFilter('entityType')} className={inputClass}>
            <option value="">{t('audit.allEntities')}</option>
            {ENTITY_TYPES.map((e) => <option key={e} value={e}>{t(`audit.entityTypes.${e}`, { defaultValue: e })}</option>)}
          </select>
        </label>
        <label className="text-xs font-bold text-slate-700">
          {t('audit.entityId')}
          <input type="number" min="1" step="1" value={filters.entityId} onChange={setFilter('entityId')} placeholder={t('audit.entityIdPlaceholder')} className={inputClass} />
        </label>
        <label className="text-xs font-bold text-slate-700">
          {t('audit.product')}
          <input
            type="text"
            list="audit-product-options"
            value={filters.productText}
            onChange={setFilter('productText')}
            placeholder={t('audit.productPlaceholder')}
            className={inputClass}
          />
          <datalist id="audit-product-options">
            {productOptions.map((o) => <option key={o.id} value={o.label} />)}
          </datalist>
        </label>
        <label className="text-xs font-bold text-slate-700">
          {t('audit.from')}
          <input type="date" value={filters.from} max={filters.to || undefined} onChange={setFilter('from')} className={inputClass} />
        </label>
        <label className="text-xs font-bold text-slate-700">
          {t('audit.to')}
          <input type="date" value={filters.to} min={filters.from || undefined} onChange={setFilter('to')} className={inputClass} />
        </label>
        <button type="submit" className="self-end rounded-lg bg-teal-700 px-4 py-2 text-sm font-bold text-white hover:bg-teal-800">
          {t('audit.applyFilters')}
        </button>
        <button type="button" onClick={clearFilters} className="self-end rounded-lg border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50">
          {t('audit.clearFilters')}
        </button>
        {filterError && <p role="alert" className="text-xs font-semibold text-red-700 sm:col-span-2 lg:col-span-4">{filterError}</p>}
      </form>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-soft overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase text-[11px] font-bold">
              <tr>
                <th className="py-3 px-4">{t('audit.timestamp')}</th>
                <th className="py-3 px-4">{t('audit.user')}</th>
                <th className="py-3 px-4">{t('audit.action')}</th>
                <th className="py-3 px-4">{t('audit.entity')}</th>
                <th className="py-3 px-4">{t('audit.branch')}</th>
                <th className="py-3 px-4">{t('audit.details')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
              {loading ? (
                <tr><td colSpan="6" className="py-8 text-center text-slate-400">{t('common.loading')}</td></tr>
              ) : errorCode ? (
                <tr>
                  <td colSpan="6" className="py-8 text-center text-red-700">
                    <span role="alert">{t(`errors.${errorCode}`, { defaultValue: t('audit.loadError') })}</span>{' '}
                    <button type="button" onClick={() => load(page, appliedRef.current)} className="font-bold underline">
                      {t('common.retry')}
                    </button>
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr><td colSpan="6" className="py-8 text-center text-slate-400">{t('audit.noMatches')}</td></tr>
              ) : (
                logs.map((log) => {
                  const fields = changedFields(log.oldValue, log.newValue)
                  const isOpen = expanded.has(log.id)
                  return (
                    <FragmentRow key={log.id}>
                      <tr className="hover:bg-slate-50/70 align-top">
                        <td className="py-3 px-4 text-slate-500 whitespace-nowrap">{formatDateTime(log.createdAt, i18n.language)}</td>
                        <td className="py-3 px-4 font-bold text-slate-900">{log.createdBy?.name || '—'}</td>
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-800">{t(`audit.actions.${log.action}`, { defaultValue: log.action })}</div>
                          <span className="mt-1 inline-block rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold font-mono text-blue-800 border border-slate-200">
                            {log.action}
                          </span>
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          {log.entityType ? t(`audit.entityTypes.${log.entityType}`, { defaultValue: log.entityType }) : '—'}
                          {log.entityId !== null && log.entityId !== undefined && <span className="text-slate-400"> #{log.entityId}</span>}
                        </td>
                        <td className="py-3 px-4">{log.branchName || <span className="text-slate-400">{t('audit.noBranch')}</span>}</td>
                        <td className="py-3 px-4">
                          {fields.length === 0 ? (
                            <span className="text-slate-400">—</span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => toggleRow(log.id)}
                              aria-expanded={isOpen}
                              className="inline-flex items-center gap-1 font-bold text-blue-700 hover:underline"
                            >
                              {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                              {t(isOpen ? 'audit.hideChanges' : 'audit.viewChanges', { count: fields.length })}
                            </button>
                          )}
                        </td>
                      </tr>
                      {isOpen && fields.length > 0 && (
                        <tr className="bg-slate-50/60">
                          <td colSpan="6" className="px-4 py-3">
                            <div className="overflow-x-auto">
                              <table className="w-full max-w-3xl text-left text-[11px]">
                                <thead className="text-slate-500 font-bold">
                                  <tr>
                                    <th className="py-1 pr-4">{t('audit.field')}</th>
                                    <th className="py-1 pr-4">{t('audit.oldValue')}</th>
                                    <th className="py-1">{t('audit.newValue')}</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {fields.map((f) => (
                                    <tr key={f.key} className="border-t border-slate-200">
                                      <td className="py-1 pr-4 font-mono text-slate-700">{f.key}</td>
                                      <td className="py-1 pr-4 text-red-700 break-all">{showValue(f.before)}</td>
                                      <td className="py-1 text-emerald-700 break-all">{showValue(f.after)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </td>
                        </tr>
                      )}
                    </FragmentRow>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {!loading && !errorCode && total > PAGE_SIZE && (
          <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-sm text-slate-600">
            <span>{t('audit.pageSummary', { page, pageCount, total })}</span>
            <div className="flex gap-2">
              <button type="button" disabled={page <= 1} onClick={() => load(page - 1, appliedRef.current)} className="rounded-lg border border-slate-300 px-3 py-1.5 font-semibold disabled:opacity-40">
                {t('common.previous')}
              </button>
              <button type="button" disabled={page >= pageCount} onClick={() => load(page + 1, appliedRef.current)} className="rounded-lg border border-slate-300 px-3 py-1.5 font-semibold disabled:opacity-40">
                {t('common.next')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// A keyed wrapper so a row and its detail row can be returned together.
function FragmentRow({ children }) {
  return <>{children}</>
}
