import { describe, expect, test } from 'vitest'
import { customRange, daysSince, formatDay, isSameLocalDay, rangeFor, toYmd } from './dates'

const iso = (date: Date) => date.toISOString()

describe('local days in Manila', () => {
  test('11:59 PM and 12:00 AM are different days', () => {
    const lateNight = new Date('2026-10-12T15:59:00Z') // Oct 12, 11:59 PM Manila
    const midnight = new Date('2026-10-12T16:00:00Z') // Oct 13, 12:00 AM Manila
    expect(isSameLocalDay(lateNight, midnight)).toBe(false)
    expect(isSameLocalDay(lateNight, new Date('2026-10-11T16:00:00Z'))).toBe(true)
  })

  test('today runs from local midnight to the next midnight', () => {
    const range = rangeFor('today', new Date('2026-10-12T02:00:00Z'))
    expect(iso(range.start)).toBe('2026-10-11T16:00:00.000Z')
    expect(iso(range.end)).toBe('2026-10-12T16:00:00.000Z')
  })

  test('7 days includes today and the 6 days before', () => {
    const range = rangeFor('7days', new Date('2026-10-12T02:00:00Z'))
    expect(iso(range.start)).toBe('2026-10-05T16:00:00.000Z')
    expect(iso(range.end)).toBe('2026-10-12T16:00:00.000Z')
  })

  test('month covers the whole calendar month', () => {
    const range = rangeFor('month', new Date('2026-10-12T02:00:00Z'))
    expect(iso(range.start)).toBe('2026-09-30T16:00:00.000Z')
    expect(iso(range.end)).toBe('2026-10-31T16:00:00.000Z')
  })

  test('customRange includes the whole last day and rejects bad input', () => {
    const range = customRange('2026-10-01', '2026-10-03')
    expect(range && iso(range.start)).toBe('2026-09-30T16:00:00.000Z')
    expect(range && iso(range.end)).toBe('2026-10-03T16:00:00.000Z')
    expect(customRange('2026-10-03', '2026-10-01')).toBeNull()
    expect(customRange('2026-02-31', '2026-03-01')).toBeNull()
    expect(customRange('', '2026-03-01')).toBeNull()
  })

  test('toYmd uses the local date', () => {
    expect(toYmd(new Date('2026-10-12T16:30:00Z'))).toBe('2026-10-13')
  })

  test('daysSince counts calendar days, not 24-hour periods', () => {
    const now = new Date('2026-10-12T01:00:00Z') // Oct 12, 9 AM
    expect(daysSince('2026-10-11T15:00:00Z', now)).toBe(1) // Oct 11, 11 PM
    expect(daysSince('2026-10-12T00:30:00Z', now)).toBe(0)
    expect(daysSince('2026-09-28T02:00:00Z', now)).toBe(14)
  })

  test('formatDay shows a short month and day', () => {
    expect(formatDay('2026-10-12T02:00:00Z')).toBe('Oct 12')
  })
})
