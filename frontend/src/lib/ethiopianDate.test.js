import { describe, it, expect } from 'vitest'
import {
  gregorianToEthiopian,
  ethiopianToGregorian,
  isEthiopianLeapYear,
  daysInEthiopianMonth,
  isValidEthiopianDate,
  ethiopianToApiDate,
  apiDateToEthiopian,
  toEthiopiaTime,
} from './ethiopianDate'

// [Gregorian year, month, day] <-> [Ethiopian year, month, day]
const KNOWN = [
  [[2026, 9, 11], [2019, 1, 1]], // Ethiopian New Year 2019
  [[2026, 10, 6], [2019, 1, 26]],
  [[2026, 10, 10], [2019, 1, 30]],
  [[2026, 10, 11], [2019, 2, 1]],
  [[2023, 9, 11], [2015, 13, 6]], // 2015 is a leap year: Pagume has 6 days
  [[2023, 9, 12], [2016, 1, 1]], // the new year after a leap year starts on Sept 12
  [[2024, 9, 10], [2016, 13, 5]],
  [[2024, 9, 11], [2017, 1, 1]],
  [[2027, 9, 11], [2019, 13, 6]], // 2019 is a leap year too
  [[2027, 9, 12], [2020, 1, 1]],
  [[2026, 1, 7], [2018, 4, 29]], // day before Genna
  [[2024, 2, 29], [2016, 6, 21]], // Gregorian leap day
  [[2000, 1, 1], [1992, 4, 22]],
]

describe('calendar conversion', () => {
  it.each(KNOWN)('Gregorian %j is Ethiopian %j (and back)', (g, e) => {
    expect(gregorianToEthiopian(...g)).toEqual({ year: e[0], month: e[1], day: e[2] })
    expect(ethiopianToGregorian(...e)).toEqual({ year: g[0], month: g[1], day: g[2] })
  })

  it('round-trips every day from 1990 to 2060', () => {
    for (let y = 1990; y <= 2060; y++) {
      for (let m = 1; m <= 12; m++) {
        const days = new Date(y, m, 0).getDate()
        for (let d = 1; d <= days; d++) {
          const e = gregorianToEthiopian(y, m, d)
          expect(isValidEthiopianDate(e.year, e.month, e.day)).toBe(true)
          expect(ethiopianToGregorian(e.year, e.month, e.day)).toEqual({ year: y, month: m, day: d })
        }
      }
    }
  })
})

describe('Pagume and leap years', () => {
  it('year % 4 === 3 is a leap year', () => {
    expect(isEthiopianLeapYear(2015)).toBe(true)
    expect(isEthiopianLeapYear(2019)).toBe(true)
    expect(isEthiopianLeapYear(2016)).toBe(false)
  })
  it('month lengths', () => {
    expect(daysInEthiopianMonth(2018, 1)).toBe(30)
    expect(daysInEthiopianMonth(2018, 13)).toBe(5)
    expect(daysInEthiopianMonth(2019, 13)).toBe(6)
  })
  it('validates dates', () => {
    expect(isValidEthiopianDate(2018, 13, 6)).toBe(false)
    expect(isValidEthiopianDate(2019, 13, 6)).toBe(true)
    expect(isValidEthiopianDate(2019, 14, 1)).toBe(false)
    expect(isValidEthiopianDate(2019, 1, 31)).toBe(false)
  })
})

describe('API dates', () => {
  it('converts an Ethiopian date to a Gregorian YYYY-MM-DD string', () => {
    expect(ethiopianToApiDate(2019, 1, 1)).toBe('2026-09-11')
    expect(ethiopianToApiDate(2019, 13, 6)).toBe('2027-09-11')
  })
  it('converts a YYYY-MM-DD string to an Ethiopian date', () => {
    expect(apiDateToEthiopian('2026-10-10')).toEqual({ year: 2019, month: 1, day: 30 })
    expect(apiDateToEthiopian('not a date')).toBeNull()
    expect(apiDateToEthiopian('')).toBeNull()
  })
})

describe('timestamps use Ethiopia time (UTC+3)', () => {
  it('21:30 UTC is already the next day in Ethiopia', () => {
    const t = toEthiopiaTime('2026-10-09T21:30:00Z')
    expect(t.ethiopian).toEqual({ year: 2019, month: 1, day: 30 }) // Oct 10 in Ethiopia
    expect(t.hour).toBe(0)
    expect(t.minute).toBe(30)
  })
  it('09:30 UTC is 12:30 the same day', () => {
    const t = toEthiopiaTime('2026-10-05T09:30:00Z')
    expect(t.ethiopian).toEqual({ year: 2019, month: 1, day: 25 })
    expect(t.hour).toBe(12)
  })
  it('returns null for invalid input', () => {
    expect(toEthiopiaTime('garbage')).toBeNull()
  })
})