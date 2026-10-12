import { OWNER } from '../brand'

export function greeting(now: Date): string {
  const hour = now.getHours()
  const part = hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening'
  return `Good ${part}, ${OWNER}!`
}

export function cheer(salesCount: number, isToday: boolean): string | null {
  if (salesCount === 0) return null
  const served = `${salesCount} ${salesCount === 1 ? 'customer' : 'customers'} served.`
  return isToday ? `Nice work today, ${OWNER}! 🎉 ${served}` : `Nice work, ${OWNER}! 🎉 ${served}`
}
