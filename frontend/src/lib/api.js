import { ApiError } from './apiError'
import { tokenStore } from './tokenStore'
import { mockRequest } from './mockApi'

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api'
const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true'

// Contract 1.4: log the user out ONLY for these two codes.
const SESSION_ENDING_CODES = ['UNAUTHENTICATED', 'ACCOUNT_DISABLED']

const DEFAULT_CODES = { 401: 'UNAUTHENTICATED', 403: 'FORBIDDEN', 404: 'NOT_FOUND', 500: 'SERVER_ERROR' }

// Contract 1.4: { error: { code, message, details: [{ field, issue }] } }
function parseError(status, body) {
  const e = body?.error
  return new ApiError({
    status,
    code: e?.code || DEFAULT_CODES[status] || 'UNKNOWN',
    message: e?.message,
    details: e?.details,
  })
}

function endSession() {
  tokenStore.clear()
  if (window.location.pathname !== '/login') window.location.assign('/login')
}

async function realRequest(method, path, { body, params } = {}) {
  let url = BASE_URL + path
  if (params) {
    const clean = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '')
    const qs = new URLSearchParams(clean).toString()
    if (qs) url += '?' + qs
  }

  const isForm = typeof FormData !== 'undefined' && body instanceof FormData
  const headers = {}
  if (body !== undefined && !isForm) headers['Content-Type'] = 'application/json'
  const token = tokenStore.get()
  if (token) headers.Authorization = `Bearer ${token}`

  let res
  try {
    res = await fetch(url, {
      method,
      headers,
      body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
    })
  } catch {
    throw new ApiError({ status: 0, code: 'NETWORK_ERROR', message: 'Cannot reach the server' })
  }

  const text = await res.text()
  let json = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    json = null
  }

  if (!res.ok) throw parseError(res.status, json)
  return json // returned as is: single records are plain objects, lists are { data, page, limit, total }
}

async function request(method, path, options = {}) {
  try {
    return USE_MOCK ? await mockRequest(method, path, options) : await realRequest(method, path, options)
  } catch (err) {
    if (err instanceof ApiError && SESSION_ENDING_CODES.includes(err.code)) endSession()
    throw err
  }
}

export const api = {
  get: (path, params) => request('GET', path, { params }),
  post: (path, body) => request('POST', path, { body }),
  put: (path, body) => request('PUT', path, { body }),
  patch: (path, body) => request('PATCH', path, { body }),
  delete: (path) => request('DELETE', path),
}