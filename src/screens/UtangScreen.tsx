import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Link } from 'wouter'
import { matchesSearch } from '../data/products'
import { addCustomer, utangRows, type UtangRow } from '../data/utang'
import { db } from '../db'
import { daysSince, formatDay } from '../domain/dates'
import { formatPesos } from '../money'
import { Field, Notice, Screen, Sheet } from '../ui'
import { btn, errorMessage, inputClass } from '../ui-kit'

const OVERDUE_DAYS = 7

export function UtangScreen() {
  const rows = useLiveQuery(() => utangRows(db), [])
  const [search, setSearch] = useState('')
  const [adding, setAdding] = useState(false)
  const [now] = useState(() => new Date())

  const all = rows ?? []
  const owing = all.filter((row) => row.balance > 0)
  const totalOwed = owing.reduce((total, row) => total + row.balance, 0)
  const shown = all.filter((row) => matchesSearch(row.customer.name, search))

  return (
    <Screen
      title="Utang"
      nav
      action={
        <button
          type="button"
          aria-label="New customer"
          className="text-2xl"
          onClick={() => setAdding(true)}
        >
          ＋
        </button>
      }
    >
      <div className="rounded-xl border border-slate-200 p-3 text-center">
        Total owed
        <div className="text-3xl font-bold text-red-600">{formatPesos(totalOwed)}</div>
        <div className="text-xs text-slate-500">
          {owing.length} {owing.length === 1 ? 'customer' : 'customers'}
        </div>
      </div>
      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="🔍 Search name…"
        className={inputClass()}
      />
      <ul className="divide-y divide-slate-100">
        {shown.map((row) => (
          <UtangRowItem key={row.customer.id} row={row} now={now} />
        ))}
      </ul>
      {all.length === 0 && (
        <p className="text-sm text-slate-500">
          No customers yet. Tap ＋ or choose Utang at checkout.
        </p>
      )}
      {adding && <NewCustomerSheet onClose={() => setAdding(false)} />}
    </Screen>
  )
}

function UtangRowItem({ row, now }: { row: UtangRow; now: Date }) {
  const days = row.oldestUnpaidAt ? daysSince(row.oldestUnpaidAt, now) : null
  const status = row.oldestUnpaidAt
    ? `since ${formatDay(row.oldestUnpaidAt)} · ${days === 0 ? 'today' : `${days} ${days === 1 ? 'day' : 'days'}`}`
    : row.balance < 0
      ? 'Overpaid'
      : 'Paid up'
  const amountClass =
    row.balance < 0
      ? 'font-bold text-brand'
      : days !== null && days >= OVERDUE_DAYS
        ? 'font-bold text-red-600'
        : 'font-semibold'

  return (
    <li>
      <Link href={`/utang/${row.customer.id}`} className="flex items-center justify-between py-3">
        <span>
          <b>{row.customer.name}</b>
          <span className="block text-xs text-slate-500">{status}</span>
        </span>
        <span className={amountClass}>{formatPesos(row.balance)}</span>
      </Link>
    </li>
  )
}

function NewCustomerSheet({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    try {
      await addCustomer(db, name, note)
      onClose()
    } catch (caught) {
      setError(errorMessage(caught))
      setSaving(false)
    }
  }

  return (
    <Sheet title="New customer" onClose={onClose}>
      <Field label="Name">
        <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass()} />
      </Field>
      <Field label="Note (optional)">
        <input
          value={note}
          placeholder="e.g. near the chapel"
          onChange={(e) => setNote(e.target.value)}
          className={inputClass()}
        />
      </Field>
      {error && <Notice tone="bad">{error}</Notice>}
      <button type="button" className={btn.primary} disabled={saving} onClick={save}>
        Save customer
      </button>
    </Sheet>
  )
}
