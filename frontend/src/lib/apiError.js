export class ApiError extends Error {
  constructor({ status = 0, code = 'UNKNOWN', message = 'Request failed', details = null }) {
    super(message)
    this.name = 'ApiError'
    this.status = status // HTTP status, 0 if the server was unreachable
    this.code = code // stable English code, mapped to a translation key
    this.details = details // optional: [{ field, issue }]
  }
}