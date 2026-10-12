import { ValidationError } from './validation'

export const btn = {
  primary:
    'rounded-xl bg-brand px-4 py-3 text-center text-base font-bold text-white disabled:opacity-40',
  ghost:
    'rounded-xl border border-slate-300 bg-white px-4 py-3 text-center text-base font-bold text-slate-800 disabled:opacity-40',
  warn: 'rounded-xl bg-amber-500 px-4 py-3 text-center text-base font-bold text-white disabled:opacity-40',
  danger:
    'rounded-xl bg-red-600 px-4 py-3 text-center text-base font-bold text-white disabled:opacity-40',
  chip: 'rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold',
  chipOn: 'rounded-lg border border-brand bg-brand px-3 py-2 text-sm font-semibold text-white',
}

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
