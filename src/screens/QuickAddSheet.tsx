import { useState } from 'react'
import { EMPTY_PRODUCT_FORM, addProduct, parseProductForm } from '../data/products'
import { db, type Product } from '../db'
import { FIELD_HELP } from '../field-help'
import { Field, Notice, Sheet } from '../ui'
import { btn, errorMessage, inputClass } from '../ui-kit'
import type { FieldErrors } from '../validation'

export function QuickAddSheet({
  initialName,
  onAdded,
  onClose,
}: {
  initialName: string
  onAdded: (product: Product) => void
  onClose: () => void
}) {
  const [name, setName] = useState(initialName)
  const [price, setPrice] = useState('')
  const [errors, setErrors] = useState<FieldErrors>({})
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function save() {
    const result = parseProductForm({ ...EMPTY_PRODUCT_FORM, name, price })
    if (!result.ok) {
      setErrors(result.errors)
      return
    }
    setSaving(true)
    try {
      onAdded(await addProduct(db, result.input))
    } catch (caught) {
      setError(errorMessage(caught))
      setSaving(false)
    }
  }

  return (
    <Sheet title="Quick add" onClose={onClose}>
      <p className="text-sm text-slate-600">
        Adds the product with stock 0. Count it later in Products.
      </p>
      <Field label="Name" error={errors.name} help={FIELD_HELP.name}>
        <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass()} />
      </Field>
      <Field label="Price ₱" error={errors.price} help={FIELD_HELP.price}>
        <input
          value={price}
          inputMode="decimal"
          onChange={(e) => setPrice(e.target.value)}
          className={inputClass()}
        />
      </Field>
      {error && <Notice tone="bad">{error}</Notice>}
      <button type="button" className={btn.primary} disabled={saving} onClick={save}>
        Add to cart
      </button>
    </Sheet>
  )
}
