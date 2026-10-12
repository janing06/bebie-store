import { useRef, useState } from 'react'
import { Link, useLocation } from 'wouter'
import { useCart } from '../cart-context'
import { checkout, type CheckoutInput } from '../data/sales'
import { db } from '../db'
import { cartTotal, changeDue, setQty } from '../domain/cart'
import { formatPesos, parsePesos, type Centavos } from '../money'
import { Field, Notice, Screen } from '../ui'
import { btn, errorMessage, inputClass } from '../ui-kit'
import { CustomerPickerSheet } from './CustomerPickerSheet'

const BILLS: Centavos[] = [10000, 20000, 50000, 100000]

export function CheckoutScreen() {
  const { cart, setCart } = useCart()
  const [, navigate] = useLocation()
  const [received, setReceived] = useState<Centavos | null>(null)
  const [otherText, setOtherText] = useState<string | null>(null)
  const [pickingCustomer, setPickingCustomer] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  // A ref, not state: two taps in the same frame both see the old state value.
  const savingRef = useRef(false)

  if (cart.length === 0) {
    return (
      <Screen title="Cart" back>
        <p className="text-slate-600">The cart is empty.</p>
        <Link href="/" className={btn.primary}>
          Back to Sell
        </Link>
      </Screen>
    )
  }

  const total = cartTotal(cart)
  const change = received === null ? null : changeDue(total, received)
  const quickAmounts = [total, ...BILLS.filter((bill) => bill > total)]

  async function finish(input: CheckoutInput) {
    if (savingRef.current) return
    savingRef.current = true
    setSaving(true)
    setError('')
    try {
      const sale = await checkout(db, input)
      navigate(`/sold/${sale.id}`, { replace: true })
      setCart([])
    } catch (caught) {
      setPickingCustomer(false)
      setError(errorMessage(caught))
      savingRef.current = false
      setSaving(false)
    }
  }

  return (
    <Screen title="Cart" back>
      <ul className="divide-y divide-slate-100">
        {cart.map((line) => (
          <li key={line.productId} className="flex items-center justify-between gap-2 py-2">
            <span className="flex-1">{line.name}</span>
            <span className="flex items-center gap-2">
              <button
                type="button"
                aria-label={`Less ${line.name}`}
                className={btn.chip}
                onClick={() => setCart(setQty(cart, line.productId, line.qty - 1))}
              >
                −
              </button>
              <span className="w-8 text-center font-semibold">{line.qty}</span>
              <button
                type="button"
                aria-label={`More ${line.name}`}
                className={btn.chip}
                onClick={() => setCart(setQty(cart, line.productId, line.qty + 1))}
              >
                +
              </button>
            </span>
            <span className="w-20 text-right">{formatPesos(line.price * line.qty)}</span>
          </li>
        ))}
      </ul>

      <div className="flex items-baseline justify-between">
        <span>Total</span>
        <span className="text-3xl font-bold">{formatPesos(total)}</span>
      </div>

      <p className="text-xs font-semibold tracking-wide text-slate-500">CASH RECEIVED</p>
      <div className="flex flex-wrap gap-2">
        {quickAmounts.map((amount, index) => (
          <button
            key={amount}
            type="button"
            className={received === amount && otherText === null ? btn.chipOn : btn.chip}
            onClick={() => {
              setReceived(amount)
              setOtherText(null)
            }}
          >
            {index === 0 ? 'Exact' : formatPesos(amount)}
          </button>
        ))}
        <button
          type="button"
          className={otherText !== null ? btn.chipOn : btn.chip}
          onClick={() => {
            setOtherText('')
            setReceived(null)
          }}
        >
          Other
        </button>
      </div>
      {otherText !== null && (
        <Field label="Amount received ₱">
          <input
            value={otherText}
            inputMode="decimal"
            className={inputClass()}
            onChange={(e) => {
              setOtherText(e.target.value)
              setReceived(parsePesos(e.target.value))
            }}
          />
        </Field>
      )}
      {received !== null && change === null && (
        <Notice tone="bad">Not enough cash for {formatPesos(total)}.</Notice>
      )}
      {change !== null && (
        <div className="rounded-xl border border-slate-200 p-3 text-center">
          Change
          <div className="text-3xl font-bold text-brand">{formatPesos(change)}</div>
        </div>
      )}
      {error && <Notice tone="bad">{error}</Notice>}

      <div className="mt-auto flex gap-2">
        <button
          type="button"
          className={`${btn.warn} flex-1`}
          disabled={saving}
          onClick={() => setPickingCustomer(true)}
        >
          Utang
        </button>
        <button
          type="button"
          className={`${btn.primary} flex-[2]`}
          disabled={saving || change === null}
          onClick={() => {
            if (received !== null) void finish({ cart, payment: 'cash', cashReceived: received })
          }}
        >
          Done ✓
        </button>
      </div>

      {pickingCustomer && (
        <CustomerPickerSheet
          onPick={(customerId) => void finish({ cart, payment: 'utang', customerId })}
          onClose={() => setPickingCustomer(false)}
        />
      )}
    </Screen>
  )
}
