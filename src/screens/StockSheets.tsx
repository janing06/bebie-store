import { useState } from 'react'
import { adjustStock, costPerPiece, restock } from '../data/stock'
import { ADJUST_REASONS, db, type AdjustReason, type Product } from '../db'
import { formatPesos, parseCount, pluralize, parsePesos, type Centavos } from '../money'
import { FIELD_HELP } from '../field-help'
import { Field, Notice, Sheet, Stepper } from '../ui'
import { btn, errorMessage, inputClass } from '../ui-kit'

const REASON_LABELS: Record<AdjustReason, string> = {
  spoiled: 'Spoiled / expired',
  missing: 'Missing',
  recount: 'Recount',
  family: 'Family use',
}

export function RestockSheet({
  product,
  onClose,
  onCostSaved,
}: {
  product: Product
  onClose: () => void
  onCostSaved?: (costPerPiece: Centavos) => void
}) {
  const packSize = product.packSize
  const [unit, setUnit] = useState<'piece' | 'pack'>(packSize ? 'pack' : 'piece')
  const [count, setCount] = useState<number | null>(1)
  const [costText, setCostText] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const byPack = unit === 'pack' && packSize !== null
  const pieces = count === null ? 0 : byPack ? count * packSize : count
  const enteredCost = costText.trim() === '' ? null : parsePesos(costText)
  const costInvalid = costText.trim() !== '' && enteredCost === null
  const newCostPerPiece =
    enteredCost === null ? null : byPack ? costPerPiece(enteredCost, packSize) : enteredCost
  const costHint =
    newCostPerPiece === null
      ? undefined
      : `${byPack ? `= ${formatPesos(newCostPerPiece)} per piece · ` : ''}was ${
          product.cost === null ? 'not set' : formatPesos(product.cost)
        } · sells at ${formatPesos(product.price)}`

  async function save() {
    setSaving(true)
    try {
      await restock(db, product.id, pieces, newCostPerPiece)
      if (newCostPerPiece !== null) onCostSaved?.(newCostPerPiece)
      onClose()
    } catch (caught) {
      setError(errorMessage(caught))
      setSaving(false)
    }
  }

  return (
    <Sheet title={`Restock ${product.name}`} onClose={onClose}>
      {packSize !== null && (
        <div className="flex gap-2">
          {(['piece', 'pack'] as const).map((option) => (
            <button
              key={option}
              type="button"
              className={`${unit === option ? btn.primary : btn.ghost} flex-1`}
              onClick={() => setUnit(option)}
            >
              {option === 'piece' ? 'Pieces' : `Packs (${packSize})`}
            </button>
          ))}
        </div>
      )}
      <Stepper value={count} onChange={setCount} />
      <Field
        label={`New cost per ${byPack ? 'pack' : 'piece'} ₱ (optional)`}
        error={costInvalid ? 'Enter a cost like 165 or 8.25' : undefined}
        hint={costHint}
        help={FIELD_HELP.restockCost}
      >
        <input
          value={costText}
          inputMode="decimal"
          onChange={(e) => setCostText(e.target.value)}
          className={inputClass(costInvalid ? 'bad' : null)}
        />
      </Field>
      <div className="rounded-xl border border-slate-200 p-3 text-center">
        {product.stock} + {pieces} = <b>{pluralize(product.stock + pieces, 'pc')}</b>
      </div>
      {error && <Notice tone="bad">{error}</Notice>}
      <button
        type="button"
        className={btn.primary}
        disabled={saving || costInvalid || count === null}
        onClick={save}
      >
        Add stock
      </button>
    </Sheet>
  )
}

export function AdjustSheet({ product, onClose }: { product: Product; onClose: () => void }) {
  const [countText, setCountText] = useState(String(Math.max(product.stock, 0)))
  const [reason, setReason] = useState<AdjustReason | null>(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const actual = parseCount(countText)
  const change = actual === null ? null : actual - product.stock

  async function save() {
    if (actual === null || reason === null) return
    setSaving(true)
    try {
      await adjustStock(db, product.id, actual, reason)
      onClose()
    } catch (caught) {
      setError(errorMessage(caught))
      setSaving(false)
    }
  }

  return (
    <Sheet title="Adjust stock" onClose={onClose}>
      <Field label="Actual count now" error={actual === null ? 'Enter a whole number' : undefined}>
        <input
          value={countText}
          inputMode="numeric"
          onChange={(e) => setCountText(e.target.value)}
          className={inputClass(actual === null ? 'bad' : null)}
        />
      </Field>
      <p className="text-xs font-semibold tracking-wide text-slate-500">REASON</p>
      <div className="flex flex-wrap gap-2">
        {ADJUST_REASONS.map((option) => (
          <button
            key={option}
            type="button"
            className={reason === option ? btn.chipOn : btn.chip}
            onClick={() => setReason(option)}
          >
            {REASON_LABELS[option]}
          </button>
        ))}
      </div>
      {change !== null && change !== 0 && (
        <div className="rounded-xl border border-slate-200 p-3 text-center">
          {product.stock} → {actual}{' '}
          <span className={change < 0 ? 'font-bold text-red-600' : 'font-bold text-brand'}>
            ({change > 0 ? '+' : ''}
            {change})
          </span>
        </div>
      )}
      {error && <Notice tone="bad">{error}</Notice>}
      <button
        type="button"
        className={btn.primary}
        disabled={saving || actual === null || change === 0 || reason === null}
        onClick={save}
      >
        Save
      </button>
    </Sheet>
  )
}
