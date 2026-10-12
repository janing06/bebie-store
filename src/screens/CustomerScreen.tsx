import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { useParams } from 'wouter'
import { balanceOf, customerLedger, recordPayment } from '../data/utang'
import { db } from '../db'
import { formatDay } from '../domain/dates'
import { formatPesos, parsePesos, toPesosInput, type Centavos } from '../money'
import { Field, Notice, Screen, Sheet } from '../ui'
import { btn, errorMessage, inputClass } from '../ui-kit'

interface Entry {
  id: string
  at: string
  label: string
  amount: Centavos
  kind: 'credit' | 'payment'
}

export function CustomerScreen() {
  const { id } = useParams<{ id: string }>()
  const [paying, setPaying] = useState(false)
  const data = useLiveQuery(async () => {
    const customer = await db.customers.get(id)
    if (!customer) return null
    const { sales, payments } = await customerLedger(db, id)
    const items = await db.saleItems
      .where('saleId')
      .anyOf(sales.map((sale) => sale.id))
      .toArray()
    return { customer, sales, payments, items }
  }, [id])

  if (data === undefined) return null
  if (data === null) {
    return (
      <Screen title="Customer" back>
        <p>Customer not found.</p>
      </Screen>
    )
  }

  const { customer, sales, payments, items } = data
  const balance = balanceOf(sales, payments)
  const entries: Entry[] = [
    ...sales
      .filter((sale) => sale.payment === 'utang' && sale.voidedAt === null)
      .map((sale) => ({
        id: sale.id,
        at: sale.createdAt,
        kind: 'credit' as const,
        amount: sale.total,
        label: items
          .filter((item) => item.saleId === sale.id)
          .map((item) => `${item.name} ×${item.qty}`)
          .join(', '),
      })),
    ...payments.map((payment) => ({
      id: payment.id,
      at: payment.createdAt,
      kind: 'payment' as const,
      amount: payment.amount,
      label: 'Payment',
    })),
  ].sort((a, b) => b.at.localeCompare(a.at))

  return (
    <Screen title={customer.name} back>
      <div className="rounded-xl border border-slate-200 p-3 text-center">
        {balance < 0 ? 'Overpaid' : 'Balance'}
        <div className={`text-3xl font-bold ${balance > 0 ? 'text-red-600' : 'text-brand'}`}>
          {formatPesos(Math.abs(balance))}
        </div>
        {customer.note && <div className="text-xs text-slate-500">{customer.note}</div>}
      </div>
      <button
        type="button"
        className={btn.primary}
        disabled={balance <= 0}
        onClick={() => setPaying(true)}
      >
        Record payment
      </button>
      <p className="text-xs font-semibold tracking-wide text-slate-500">HISTORY</p>
      <ul className="divide-y divide-slate-100">
        {entries.map((entry) => (
          <li key={entry.id} className="flex items-center justify-between gap-2 py-2">
            <span>
              {entry.label}
              <span className="block text-xs text-slate-500">{formatDay(entry.at)}</span>
            </span>
            <span className={entry.kind === 'payment' ? 'font-bold text-brand' : ''}>
              {entry.kind === 'payment' ? '−' : '+'}
              {formatPesos(entry.amount)}
            </span>
          </li>
        ))}
      </ul>
      {paying && (
        <PaymentSheet customerId={customer.id} balance={balance} onClose={() => setPaying(false)} />
      )}
    </Screen>
  )
}

function PaymentSheet({
  customerId,
  balance,
  onClose,
}: {
  customerId: string
  balance: Centavos
  onClose: () => void
}) {
  const [amountText, setAmountText] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function save() {
    const amount = parsePesos(amountText)
    if (amount === null) {
      setError('Enter an amount like 50 or 50.25')
      return
    }
    setSaving(true)
    try {
      await recordPayment(db, customerId, amount)
      onClose()
    } catch (caught) {
      setError(errorMessage(caught))
      setSaving(false)
    }
  }

  return (
    <Sheet title="Record payment" onClose={onClose}>
      <Field label="Amount paid ₱">
        <input
          value={amountText}
          inputMode="decimal"
          onChange={(e) => setAmountText(e.target.value)}
          className={inputClass()}
        />
      </Field>
      <button
        type="button"
        className={btn.chip}
        onClick={() => setAmountText(toPesosInput(balance))}
      >
        Full balance {formatPesos(balance)}
      </button>
      {error && <Notice tone="bad">{error}</Notice>}
      <button type="button" className={btn.primary} disabled={saving} onClick={save}>
        Save payment
      </button>
    </Sheet>
  )
}
