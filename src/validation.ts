export type FieldErrors = Record<string, string>

/** A user-fixable input problem. `message` is safe to show on screen. */
export class ValidationError extends Error {
  readonly fields: FieldErrors

  constructor(fields: FieldErrors) {
    super(Object.values(fields).join(' '))
    this.name = 'ValidationError'
    this.fields = fields
  }
}

export function isWholeNumber(value: unknown, min = 0): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= min
}
