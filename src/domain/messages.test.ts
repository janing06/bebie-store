import { describe, expect, test } from 'vitest'
import { cheer, greeting } from './messages'

describe('greeting', () => {
  test.each([
    ['2026-10-12T00:00:00', 'Good morning, Bebie!'],
    ['2026-10-12T11:59:00', 'Good morning, Bebie!'],
    ['2026-10-12T12:00:00', 'Good afternoon, Bebie!'],
    ['2026-10-12T17:59:00', 'Good afternoon, Bebie!'],
    ['2026-10-12T18:00:00', 'Good evening, Bebie!'],
  ])('at local time %s says %s', (local, expected) => {
    expect(greeting(new Date(local))).toBe(expected)
  })
})

describe('cheer', () => {
  test('celebrates today with the number of customers', () => {
    expect(cheer(48, true)).toBe('Nice work today, Bebie! 🎉 48 customers served.')
    expect(cheer(1, false)).toBe('Nice work, Bebie! 🎉 1 customer served.')
  })

  test('says nothing when there were no sales', () => {
    expect(cheer(0, true)).toBeNull()
  })
})
