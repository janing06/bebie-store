/** Money is always stored as whole centavos: ₱12.50 is 1250. */
export type Centavos = number

// Plain digits, or digits grouped in thousands with commas, plus up to 2 decimals.
const PESOS_PATTERN = /^(\d+|\d{1,3}(,\d{3})+)(\.\d{1,2})?$/
const COUNT_PATTERN = /^\d+$/

export function parsePesos(input: string): Centavos | null {
  const text = input.trim()
  if (!PESOS_PATTERN.test(text)) return null
  const [whole, fraction = ''] = text.replaceAll(',', '').split('.')
  return Number(whole) * 100 + Number(fraction.padEnd(2, '0'))
}

export function parseCount(input: string): number | null {
  const text = input.trim()
  return COUNT_PATTERN.test(text) ? Number(text) : null
}

export function formatPesos(amount: Centavos): string {
  const sign = amount < 0 ? '−' : ''
  const abs = Math.abs(amount)
  const whole = Math.floor(abs / 100).toLocaleString('en-PH')
  const cents = abs % 100
  return `${sign}₱${whole}${cents === 0 ? '' : `.${String(cents).padStart(2, '0')}`}`
}

/** Text for a form field: "75" or "8.25". */
export function toPesosInput(amount: Centavos): string {
  return amount % 100 === 0 ? String(amount / 100) : (amount / 100).toFixed(2)
}

/** Integer division of a non-negative amount, rounding .5 up. */
export function divideRoundHalfUp(amount: Centavos, divisor: number): Centavos {
  return Math.floor((amount * 2 + divisor) / (divisor * 2))
}
