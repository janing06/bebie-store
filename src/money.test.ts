import { describe, expect, test } from 'vitest'
import { divideRoundHalfUp, formatPesos, parseCount, parsePesos, toPesosInput } from './money'

describe('parsePesos', () => {
  test.each([
    ['12', 1200],
    ['12.5', 1250],
    ['12.50', 1250],
    [' 0 ', 0],
    ['1,234.50', 123450],
    ['1,234,567', 123456700],
  ])('reads %s as %d centavos', (input, expected) => {
    expect(parsePesos(input)).toBe(expected)
  })

  test.each(['', 'abc', '-5', '1.234', '12.', '.5', '1,5', '12,50', '1,23'])(
    'rejects %s',
    (input) => {
      expect(parsePesos(input)).toBeNull()
    },
  )
})

describe('parseCount', () => {
  test('reads whole numbers', () => {
    expect(parseCount(' 24 ')).toBe(24)
    expect(parseCount('0')).toBe(0)
  })

  test.each(['', '2.5', '-1', 'ten'])('rejects %s', (input) => {
    expect(parseCount(input)).toBeNull()
  })
})

describe('formatPesos', () => {
  test.each([
    [7500, '₱75'],
    [1250, '₱12.50'],
    [5, '₱0.05'],
    [123450, '₱1,234.50'],
    [0, '₱0'],
    [-600, '−₱6'],
  ])('formats %d as %s', (amount, expected) => {
    expect(formatPesos(amount)).toBe(expected)
  })
})

describe('toPesosInput', () => {
  test('drops .00 for whole pesos and keeps two decimals otherwise', () => {
    expect(toPesosInput(7500)).toBe('75')
    expect(toPesosInput(825)).toBe('8.25')
    expect(toPesosInput(1250)).toBe('12.50')
  })
})

describe('divideRoundHalfUp', () => {
  test.each([
    [16500, 20, 825],
    [10000, 12, 833],
    [25, 2, 13],
    [1000, 8, 125],
  ])('%d / %d = %d', (amount, divisor, expected) => {
    expect(divideRoundHalfUp(amount, divisor)).toBe(expected)
  })
})
