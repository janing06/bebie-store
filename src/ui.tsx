import { useState, type ReactNode } from 'react'
import { Link, useLocation } from 'wouter'
import { parseCount } from './money'
import { btn, errorMessage } from './ui-kit'

const TABS = [
  { href: '/', label: 'Sell' },
  { href: '/products', label: 'Products' },
  { href: '/utang', label: 'Utang' },
  { href: '/reports', label: 'Reports' },
  { href: '/more', label: 'More' },
] as const

export function Screen({
  title,
  subtitle,
  back = false,
  action,
  footer,
  nav = false,
  children,
}: {
  title: string
  subtitle?: string
  back?: boolean
  action?: ReactNode
  footer?: ReactNode
  nav?: boolean
  children: ReactNode
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-white text-slate-900">
      <header className="sticky top-0 z-10 bg-brand px-4 py-3 text-white">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-lg font-semibold">
            {back && (
              <button
                type="button"
                aria-label="Back"
                className="mr-2"
                onClick={() => window.history.back()}
              >
                ‹
              </button>
            )}
            {title}
          </h1>
          {action}
        </div>
        {subtitle && <p className="text-sm opacity-90">{subtitle}</p>}
      </header>
      <main className="flex flex-1 flex-col gap-3 p-3">{children}</main>
      {(footer || nav) && (
        <div className="sticky bottom-0 bg-white">
          {footer}
          {nav && <BottomNav />}
        </div>
      )}
    </div>
  )
}

export function BottomNav() {
  const [location] = useLocation()
  return (
    <nav className="flex border-t border-slate-200">
      {TABS.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          className={`flex-1 py-3 text-center text-sm ${
            location === tab.href ? 'font-bold text-brand' : 'text-slate-500'
          }`}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  )
}

export function Sheet({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: ReactNode
}) {
  return (
    <div className="fixed inset-0 z-20 flex flex-col justify-end bg-black/40" onClick={onClose}>
      <div
        role="dialog"
        aria-label={title}
        className="flex max-h-[90dvh] flex-col gap-3 overflow-y-auto rounded-t-2xl bg-white p-4"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 className="text-lg font-bold">{title}</h2>
        {children}
      </div>
    </div>
  )
}

export function ConfirmSheet({
  title,
  message,
  confirmLabel,
  danger = false,
  onConfirm,
  onClose,
}: {
  title: string
  message: string
  confirmLabel: string
  danger?: boolean
  onConfirm: () => Promise<void>
  onClose: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function confirm() {
    setBusy(true)
    try {
      await onConfirm()
      onClose()
    } catch (caught) {
      setError(errorMessage(caught))
      setBusy(false)
    }
  }

  return (
    <Sheet title={title} onClose={onClose}>
      <p className="text-slate-700">{message}</p>
      {error && <Notice tone="bad">{error}</Notice>}
      <button
        type="button"
        className={danger ? btn.danger : btn.primary}
        disabled={busy}
        onClick={confirm}
      >
        {confirmLabel}
      </button>
      <button type="button" className={btn.ghost} onClick={onClose}>
        Cancel
      </button>
    </Sheet>
  )
}

export function Field({
  label,
  error,
  hint,
  children,
}: {
  label: string
  error?: string
  hint?: string
  children: ReactNode
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-semibold tracking-wide text-slate-500 uppercase">{label}</span>
      {children}
      {hint && <span className="text-xs font-semibold text-brand">{hint}</span>}
      {error && <span className="text-xs text-red-600">{error}</span>}
    </label>
  )
}

/** A typeable count with − / + buttons. `value` is null while the typed text is not a valid count. */
export function Stepper({
  value,
  onChange,
  min = 1,
}: {
  value: number | null
  onChange: (value: number | null) => void
  min?: number
}) {
  const [text, setText] = useState(String(value ?? ''))

  function change(next: number | null) {
    setText(next === null ? '' : String(next))
    onChange(next)
  }

  function type(input: string) {
    setText(input)
    const parsed = parseCount(input)
    onChange(parsed !== null && parsed >= min ? parsed : null)
  }

  return (
    <div className="flex items-center justify-center gap-6">
      <button
        type="button"
        aria-label="Less"
        className={`${btn.chip} h-12 w-12 text-2xl`}
        disabled={value === null || value <= min}
        onClick={() => change((value ?? min) - 1)}
      >
        −
      </button>
      <input
        aria-label="Count"
        inputMode="numeric"
        value={text}
        onChange={(event) => type(event.target.value)}
        className="w-20 rounded-xl border border-slate-300 py-2 text-center text-2xl font-bold"
      />
      <button
        type="button"
        aria-label="More"
        className={`${btn.chip} h-12 w-12 text-2xl`}
        onClick={() => change((value ?? min - 1) + 1)}
      >
        +
      </button>
    </div>
  )
}

const NOTICE_TONES = {
  warn: 'border-amber-500 bg-amber-50 text-amber-900',
  bad: 'border-red-600 bg-red-50 text-red-900',
  good: 'border-brand bg-brand-soft text-emerald-900',
}

export function Notice({
  tone,
  children,
}: {
  tone: keyof typeof NOTICE_TONES
  children: ReactNode
}) {
  return <div className={`rounded-xl border p-3 text-sm ${NOTICE_TONES[tone]}`}>{children}</div>
}
