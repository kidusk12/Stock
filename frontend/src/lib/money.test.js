import { describe, it, expect } from 'vitest'
import { formatBirr, roundMoney } from './money'

const NBSP = '\u00A0'
const en = (key) => ({ 'money.currency': 'ETB' })[key]
const am = (key) => ({ 'money.currency': 'ብር' })[key]

describe('roundMoney', () => {
  it('rounds half up without float drift', () => {
    expect(roundMoney(1.005)).toBe(1.01)
    expect(roundMoney(0.285)).toBe(0.29)
    expect(roundMoney(0.1 + 0.2)).toBe(0.3)
    expect(roundMoney(1234567.891)).toBe(1234567.89)
  })
  it('rounds negatives the same way as positives', () => {
    expect(roundMoney(-2.675)).toBe(-2.68)
    expect(roundMoney(-0.004)).toBe(-0) // formatBirr never shows a minus for zero
  })
  it('returns NaN for non-numbers', () => {
    expect(roundMoney('abc')).toBeNaN()
    expect(roundMoney(undefined)).toBeNaN()
  })
  it('handles tiny and huge values', () => {
    expect(roundMoney(1e-7)).toBe(0)
    expect(roundMoney(2e21)).toBe(2e21)
  })
})

describe('formatBirr', () => {
  it('formats with currency, grouping and 2 decimals', () => {
    expect(formatBirr(1150, en)).toBe(`ETB${NBSP}1,150.00`)
    expect(formatBirr(25.5, en)).toBe(`ETB${NBSP}25.50`)
    expect(formatBirr(1234567.891, en)).toBe(`ETB${NBSP}1,234,567.89`)
    expect(formatBirr(0, en)).toBe(`ETB${NBSP}0.00`)
  })
  it('uses the Amharic currency name but still Western digits', () => {
    expect(formatBirr(1150, am)).toBe(`ብር${NBSP}1,150.00`)
  })
  it('can leave the currency off', () => {
    expect(formatBirr(1150, en, { symbol: false })).toBe('1,150.00')
  })
  it('puts the minus sign before the currency', () => {
    expect(formatBirr(-50, en)).toBe(`-ETB${NBSP}50.00`)
  })
  it('never shows negative zero', () => {
    expect(formatBirr(-0.001, en)).toBe(`ETB${NBSP}0.00`)
    expect(formatBirr(-0, en)).toBe(`ETB${NBSP}0.00`)
  })
  it('accepts numeric strings and ignores empty or invalid values', () => {
    expect(formatBirr('25.00', en)).toBe(`ETB${NBSP}25.00`)
    expect(formatBirr(null, en)).toBe('')
    expect(formatBirr(undefined, en)).toBe('')
    expect(formatBirr('', en)).toBe('')
    expect(formatBirr('abc', en)).toBe('')
  })
  it('formats the contract examples', () => {
    expect(formatBirr(1150.0, en)).toBe(`ETB${NBSP}1,150.00`) // VAT 15% example total
    expect(formatBirr(150.0, en)).toBe(`ETB${NBSP}150.00`) // its tax amount
    expect(formatBirr(43.48, en)).toBe(`ETB${NBSP}43.48`) // netAmount from the sale example
  })
})