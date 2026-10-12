import { ValidationError } from './validation'

const PRESS = 'select-none transition active:scale-[0.98] active:opacity-80'

export const btn = {
  primary: `${PRESS} rounded-xl bg-brand px-4 py-3 text-center text-base font-bold text-white disabled:opacity-40`,
  ghost: `${PRESS} rounded-xl border border-slate-300 bg-white px-4 py-3 text-center text-base font-bold text-slate-800 disabled:opacity-40`,
  warn: `${PRESS} rounded-xl bg-amber-500 px-4 py-3 text-center text-base font-bold text-white disabled:opacity-40`,
  danger: `${PRESS} rounded-xl bg-red-600 px-4 py-3 text-center text-base font-bold text-white disabled:opacity-40`,
  chip: `${PRESS} min-h-11 min-w-11 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold`,
  chipOn: `${PRESS} min-h-11 min-w-11 rounded-lg border border-brand bg-brand px-3 py-2 text-sm font-semibold text-white`,
}

/** A tappable list row: at least 48px tall with a pressed state. */
export const ROW = 'flex min-h-12 select-none items-center justify-between py-3 active:bg-slate-100'

const INPUT_BASE = 'w-full rounded-xl border px-3 py-2 text-base'

export function inputClass(highlight: 'changed' | 'bad' | null = null): string {
  if (highlight === 'changed') return `${INPUT_BASE} border-amber-500 bg-amber-50`
  if (highlight === 'bad') return `${INPUT_BASE} border-red-600 bg-red-50`
  return `${INPUT_BASE} border-slate-300`
}

/** Logs the error and returns a message that is safe to show to Bebie. */
export function errorMessage(error: unknown): string {
  console.error(error)
  return error instanceof ValidationError ? error.message : 'Not saved. Please try again.'
}
