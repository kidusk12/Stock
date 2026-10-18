// Ethiopian Calendar conversion & ETB currency formatting

const ETH_MONTHS_EN = [
  'Meskerem', 'Tikimt', 'Hidar', 'Tahsas', 'Tir', 'Yakatit',
  'Megabit', 'Miazia', 'Ginbot', 'Sene', 'Hamle', 'Nehase', 'Pagume'
]

const ETH_MONTHS_AM = [
  'መስከረም', 'ጥቅምት', 'ኅዳር', 'ታኅሣሥ', 'ጥር', 'የካቲት',
  'መጋቢት', 'ሚያዝያ', 'ግንቦት', 'ሰኔ', 'ሐምሌ', 'ነሐሴ', 'ጳጉሜ'
]

/**
 * Converts a Gregorian Date to Ethiopian Date
 * @param {Date|string|number} inputDate 
 * @returns {{ year: number, month: number, day: number, monthNameEn: string, monthNameAm: string, formattedEn: string, formattedAm: string }}
 */
export function toEthiopianDate(inputDate) {
  const date = inputDate ? new Date(inputDate) : new Date()
  if (isNaN(date.getTime())) return null

  const gYear = date.getFullYear()
  const gMonth = date.getMonth() + 1 // 1-12
  const gDay = date.getDate()

  // Julian day calculation
  const a = Math.floor((14 - gMonth) / 12)
  const y = gYear + 4800 - a
  const m = gMonth + 12 * a - 3
  const jdn = gDay + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) - 32045

  // Ethiopian calendar epoch offset
  const ethEpoch = 1723856
  const r = (jdn - ethEpoch) % 1461
  const n = (r % 365) + 365 * Math.floor(r / 1460)

  const ethYear = 4 * Math.floor((jdn - ethEpoch) / 1461) + Math.floor(r / 365) - Math.floor(r / 1460)
  const ethMonth = Math.floor(n / 30) + 1
  const ethDay = (n % 30) + 1

  const monthIdx = Math.min(Math.max(ethMonth - 1, 0), 12)
  const monthNameEn = ETH_MONTHS_EN[monthIdx]
  const monthNameAm = ETH_MONTHS_AM[monthIdx]

  return {
    year: ethYear,
    month: ethMonth,
    day: ethDay,
    monthNameEn,
    monthNameAm,
    formattedEn: `${monthNameEn} ${ethDay}, ${ethYear}`,
    formattedAm: `${monthNameAm} ${ethDay} ቀን ${ethYear} ዓ.ም`,
  }
}

/**
 * Format currency in ETB (Ethiopian Birr)
 * @param {number|string} amount 
 * @param {string} lang 'en' or 'am'
 * @returns {string} e.g. "ETB 1,250.00" or "1,250.00 ብር"
 */
export function formatETB(amount, lang = 'en') {
  const num = Number(amount) || 0
  const formatted = num.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  return lang === 'am' ? `${formatted} ብር` : `ETB ${formatted}`
}

/**
 * Formats a date string into readable Ethiopian date or fallback Gregorian
 */
export function formatDate(isoDate, lang = 'en') {
  if (!isoDate) return '-'
  const eth = toEthiopianDate(isoDate)
  if (!eth) return '-'
  return lang === 'am' ? eth.formattedAm : eth.formattedEn
}
