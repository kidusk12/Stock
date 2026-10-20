import i18n from '../i18n'

// Ethiopia uses UTC+3 throughout the year and does not observe daylight saving.
const JDN_OFFSET = 1723856
export const ETHIOPIA_UTC_OFFSET_HOURS = 3

export const isEthiopianLeapYear = (year) => year % 4 === 3

export function daysInEthiopianMonth(year, month) {
  if (month < 13) return 30
  return isEthiopianLeapYear(year) ? 6 : 5
}

export function isValidEthiopianDate(year, month, day) {
  return Number.isInteger(year) && Number.isInteger(month) && Number.isInteger(day) &&
    year >= 1 && month >= 1 && month <= 13 && day >= 1 &&
    day <= daysInEthiopianMonth(year, month)
}

function gregorianToJdn(year, month, day) {
  const a = Math.floor((14 - month) / 12)
  const y = year + 4800 - a
  const m = month + 12 * a - 3
  return day + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4) -
    Math.floor(y / 100) + Math.floor(y / 400) - 32045
}

function jdnToGregorian(jdn) {
  const a = jdn + 32044
  const b = Math.floor((4 * a + 3) / 146097)
  const c = a - Math.floor(146097 * b / 4)
  const d = Math.floor((4 * c + 3) / 1461)
  const e = c - Math.floor(1461 * d / 4)
  const m = Math.floor((5 * e + 2) / 153)
  return {
    day: e - Math.floor((153 * m + 2) / 5) + 1,
    month: m + 3 - 12 * Math.floor(m / 10),
    year: 100 * b + d - 4800 + Math.floor(m / 10),
  }
}

function ethiopianToJdn(year, month, day) {
  return JDN_OFFSET + 365 + 365 * (year - 1) + Math.floor(year / 4) + 30 * month + day - 31
}

function jdnToEthiopian(jdn) {
  const r = (jdn - JDN_OFFSET) % 1461
  const n = (r % 365) + 365 * Math.floor(r / 1460)
  return {
    year: 4 * Math.floor((jdn - JDN_OFFSET) / 1461) + Math.floor(r / 365) - Math.floor(r / 1460),
    month: Math.floor(n / 30) + 1,
    day: n % 30 + 1,
  }
}

export const gregorianToEthiopian = (year, month, day) =>
  jdnToEthiopian(gregorianToJdn(year, month, day))

export const ethiopianToGregorian = (year, month, day) =>
  jdnToGregorian(ethiopianToJdn(year, month, day))

const pad = (value, width = 2) => String(value).padStart(width, '0')

export function ethiopianToApiDate(year, month, day) {
  if (!isValidEthiopianDate(year, month, day)) return null
  const gregorian = ethiopianToGregorian(year, month, day)
  return `${pad(gregorian.year, 4)}-${pad(gregorian.month)}-${pad(gregorian.day)}`
}

export function apiDateToEthiopian(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || '')
  if (!match) return null
  const [, year, month, day] = match.map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  if (date.getUTCFullYear() !== year || date.getUTCMonth() + 1 !== month || date.getUTCDate() !== day) return null
  return gregorianToEthiopian(year, month, day)
}

export function toEthiopiaTime(value) {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return null
  const shifted = new Date(date.getTime() + ETHIOPIA_UTC_OFFSET_HOURS * 3600000)
  const gregorian = {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  }
  return {
    ethiopian: gregorianToEthiopian(gregorian.year, gregorian.month, gregorian.day),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
  }
}

export const todayEthiopian = () => toEthiopiaTime(new Date())?.ethiopian ?? null

// Existing screen-facing API is retained for compatibility.
export function toEthiopianDate(inputDate) {
  if (inputDate === '') return null
  const value = inputDate === null || inputDate === undefined ? new Date() : inputDate
  const localTime = toEthiopiaTime(value)
  if (!localTime) return null
  const { year, month, day } = localTime.ethiopian
  const monthNameEn = i18n.getFixedT('en')('calendar.months', { returnObjects: true })[month - 1]
  const monthNameAm = i18n.getFixedT('am')('calendar.months', { returnObjects: true })[month - 1]
  return {
    year,
    month,
    day,
    monthNameEn,
    monthNameAm,
    formattedEn: `${monthNameEn} ${day}, ${year}`,
    formattedAm: `${monthNameAm} ${day} ቀን ${year} ዓ.ም`,
  }
}

export function formatETB(amount, lang = 'en') {
  if (amount === null || amount === undefined || amount === '') return '—'
  const numericAmount = Number(amount)
  if (!Number.isFinite(numericAmount)) return '—'
  const formatted = numericAmount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  return lang === 'am' ? `${formatted} ብር` : `ETB ${formatted}`
}

export function formatDate(value, lang = 'en') {
  if (value === null || value === undefined || value === '') return '-'
  const eth = toEthiopianDate(value)
  if (!eth) return '-'
  return lang === 'am' ? eth.formattedAm : eth.formattedEn
}
