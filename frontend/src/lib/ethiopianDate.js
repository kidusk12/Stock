// Pure date logic: no React and no text in this file, so it is easy to test.
// Month names live in en.json / am.json under "calendar.months".

const JDN_OFFSET = 1723856 // Julian Day Number just before Ethiopian year 1
export const ETHIOPIA_UTC_OFFSET_HOURS = 3 // Ethiopia has no daylight saving

// Ethiopian leap years are the years where year % 4 === 3. Pagume has 6 days then, else 5.
export const isEthiopianLeapYear = (year) => year % 4 === 3

export function daysInEthiopianMonth(year, month) {
  if (month < 13) return 30
  return isEthiopianLeapYear(year) ? 6 : 5
}

export function isValidEthiopianDate(year, month, day) {
  return (
    Number.isInteger(year) &&
    Number.isInteger(month) &&
    Number.isInteger(day) &&
    year >= 1 &&
    month >= 1 &&
    month <= 13 &&
    day >= 1 &&
    day <= daysInEthiopianMonth(year, month)
  )
}

function gregorianToJdn(year, month, day) {
  const a = Math.floor((14 - month) / 12)
  const y = year + 4800 - a
  const m = month + 12 * a - 3
  return (
    day +
    Math.floor((153 * m + 2) / 5) +
    365 * y +
    Math.floor(y / 4) -
    Math.floor(y / 100) +
    Math.floor(y / 400) -
    32045
  )
}

function jdnToGregorian(jdn) {
  const a = jdn + 32044
  const b = Math.floor((4 * a + 3) / 146097)
  const c = a - Math.floor((146097 * b) / 4)
  const d = Math.floor((4 * c + 3) / 1461)
  const e = c - Math.floor((1461 * d) / 4)
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
    day: (n % 30) + 1,
  }
}

// ---- Conversion between calendars: results are { year, month, day } ----
export const gregorianToEthiopian = (year, month, day) => jdnToEthiopian(gregorianToJdn(year, month, day))
export const ethiopianToGregorian = (year, month, day) => jdnToGregorian(ethiopianToJdn(year, month, day))

// ---- API dates: 'YYYY-MM-DD' (Gregorian). The server reads them as that day in Ethiopia time. ----
const pad = (n, width = 2) => String(n).padStart(width, '0')

export function ethiopianToApiDate(year, month, day) {
  const g = ethiopianToGregorian(year, month, day)
  return `${pad(g.year, 4)}-${pad(g.month)}-${pad(g.day)}`
}

export function apiDateToEthiopian(text) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text || '')
  if (!match) return null
  return gregorianToEthiopian(Number(match[1]), Number(match[2]), Number(match[3]))
}

// ---- Timestamps: the API sends UTC (e.g. 2026-10-05T09:30:00Z). Show them in Ethiopia time (UTC+3). ----
export function toEthiopiaTime(value) {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return null
  const shifted = new Date(date.getTime() + ETHIOPIA_UTC_OFFSET_HOURS * 3600 * 1000)
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

export const todayEthiopian = () => toEthiopiaTime(new Date()).ethiopian