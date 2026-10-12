const DAY_MS = 86_400_000

export type RangeKey = 'today' | '7days' | 'month'

/** `end` is exclusive. */
export interface DateRange {
  start: Date
  end: Date
}

export function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days)
}

export function isSameLocalDay(a: Date, b: Date): boolean {
  return startOfLocalDay(a).getTime() === startOfLocalDay(b).getTime()
}

export function rangeFor(key: RangeKey, now: Date): DateRange {
  const today = startOfLocalDay(now)
  switch (key) {
    case 'today':
      return { start: today, end: addDays(today, 1) }
    case '7days':
      return { start: addDays(today, -6), end: addDays(today, 1) }
    case 'month':
      return {
        start: new Date(now.getFullYear(), now.getMonth(), 1),
        end: new Date(now.getFullYear(), now.getMonth() + 1, 1),
      }
  }
}

/** From and to are "YYYY-MM-DD" (as given by <input type="date">), both days included. */
export function customRange(fromYmd: string, toYmd: string): DateRange | null {
  const from = parseYmd(fromYmd)
  const to = parseYmd(toYmd)
  if (!from || !to || from > to) return null
  return { start: from, end: addDays(to, 1) }
}

function parseYmd(text: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text)
  if (!match) return null
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])]
  const date = new Date(year, month - 1, day)
  return date.getMonth() === month - 1 && date.getDate() === day ? date : null
}

export function toYmd(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** Calendar days between the day of `iso` and the day of `now`. */
export function daysSince(iso: string, now: Date): number {
  const diff = startOfLocalDay(now).getTime() - startOfLocalDay(new Date(iso)).getTime()
  return Math.round(diff / DAY_MS)
}

export function formatDay(iso: string): string {
  return new Date(iso).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' })
}
