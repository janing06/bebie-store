import { useState, type ReactNode } from 'react'
import {
  ChartColumn,
  ChevronLeft,
  Menu,
  Minus,
  NotebookPen,
  Package,
  Plus,
  Search,
  Store,
  X,
} from 'lucide-react'
import { Link, useLocation } from 'wouter'
import { parseCount } from './money'
import { btn, errorMessage, inputClass } from './ui-kit'

const TABS = [
  { href: '/', label: 'Sell', Icon: Store },
  { href: '/products', label: 'Products', Icon: Package },
  { href: '/utang', label: 'Utang', Icon: NotebookPen },
  { href: '/reports', label: 'Reports', Icon: ChartColumn },
  { href: '/more', label: 'More', Icon: Menu },
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
        <div className="flex items-center gap-1">
          {back && (
            <button
              type="button"
              aria-label="Back"
              className="-ml-3 flex h-11 w-11 items-center justify-center"
              onClick={() => window.history.back()}
            >
              <ChevronLeft aria-hidden size={28} />
            </button>
          )}
          <h1 className="flex-1 text-lg font-semibold">{title}</h1>
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
      {TABS.map(({ href, label, Icon }) => (
        <Link
          key={href}
          href={href}
          className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-xs ${
            location === href ? 'font-bold text-brand' : 'text-slate-500'
          }`}
        >
          <Icon aria-hidden size={24} />
          {label}
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
        <Minus aria-hidden />
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
        <Plus aria-hidden />
      </button>
    </div>
  )
}

export function SearchInput({
  value,
  onChange,
  placeholder,
}: {
  value: string
  onChange: (value: string) => void
  placeholder: string
}) {
  return (
    <div className="relative">
      <Search
        aria-hidden
        size={20}
        className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-slate-400"
      />
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className={`${inputClass()} pr-11 pl-10`}
      />
      {value !== '' && (
        <button
          type="button"
          aria-label="Clear search"
          className="absolute top-1/2 right-0 flex h-11 w-11 -translate-y-1/2 items-center justify-center text-slate-400"
          onClick={() => onChange('')}
        >
          <X aria-hidden size={20} />
        </button>
      )}
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
