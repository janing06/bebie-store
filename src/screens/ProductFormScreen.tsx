import { useLiveQuery } from 'dexie-react-hooks'
import { useState, type ChangeEvent } from 'react'
import { Link, useLocation, useParams } from 'wouter'
import {
  addProduct,
  findSimilar,
  parseProductForm,
  setProductActive,
  updateProduct,
  type ProductForm,
} from '../data/products'
import { db, type Product } from '../db'
import { formatPesos, parsePesos, toPesosInput } from '../money'
import { ConfirmSheet, Field, Notice, Screen } from '../ui'
import { btn, errorMessage, inputClass } from '../ui-kit'
import type { FieldErrors } from '../validation'
import { AdjustSheet, RestockSheet } from './StockSheets'

export function ProductFormScreen() {
  const { id } = useParams<{ id?: string }>()
  const products = useLiveQuery(() => db.products.toArray(), [])
  if (!products) return null
  const product = id ? products.find((p) => p.id === id) : undefined
  if (id && !product) {
    return (
      <Screen title="Product" back>
        <p>Product not found.</p>
      </Screen>
    )
  }
  // The key resets the form when switching between products.
  return <ProductEditor key={product?.id ?? 'new'} product={product} products={products} />
}

function toForm(product?: Product): ProductForm {
  return {
    name: product?.name ?? '',
    price: product ? toPesosInput(product.price) : '',
    cost: product?.cost != null ? toPesosInput(product.cost) : '',
    startingStock: '',
    lowStockAt: product?.lowStockAt != null ? String(product.lowStockAt) : '',
    packSize: product?.packSize != null ? String(product.packSize) : '',
    favorite: product?.favorite ?? false,
  }
}

function ProductEditor({ product, products }: { product?: Product; products: Product[] }) {
  const [, navigate] = useLocation()
  const original = toForm(product)
  const [form, setForm] = useState(original)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [saveError, setSaveError] = useState('')
  const [saving, setSaving] = useState(false)
  const [sheet, setSheet] = useState<'restock' | 'adjust' | 'stop' | null>(null)

  const editing = product !== undefined
  const similar = editing ? [] : findSimilar(products, form.name)
  const price = parsePesos(form.price)
  const cost = form.cost.trim() === '' ? null : parsePesos(form.cost)
  const belowCost = price !== null && cost !== null && price < cost
  const changed = (field: keyof ProductForm) => editing && form[field] !== original[field]

  function update(field: keyof ProductForm) {
    return (event: ChangeEvent<HTMLInputElement>) =>
      setForm({
        ...form,
        [field]: field === 'favorite' ? event.target.checked : event.target.value,
      })
  }

  function highlight(field: keyof ProductForm, bad = false) {
    if (bad || errors[field]) return inputClass('bad')
    return inputClass(changed(field) ? 'changed' : null)
  }

  async function turnOnAgain() {
    if (!product) return
    setSaving(true)
    try {
      await setProductActive(db, product.id, true)
    } catch (caught) {
      setSaveError(errorMessage(caught))
    }
    setSaving(false)
  }

  async function save() {
    const result = parseProductForm(form)
    if (!result.ok) {
      setErrors(result.errors)
      return
    }
    setSaving(true)
    try {
      if (product) await updateProduct(db, product.id, result.input)
      else await addProduct(db, result.input)
      navigate('/products', { replace: true })
    } catch (caught) {
      setSaveError(errorMessage(caught))
      setSaving(false)
    }
  }

  return (
    <Screen title={product?.name ?? 'New product'} back>
      {product && (
        <div className="flex items-center justify-between rounded-xl border border-slate-200 p-3">
          <div>
            In stock
            <div className={`text-2xl font-bold ${product.stock < 0 ? 'text-red-600' : ''}`}>
              {product.stock}
            </div>
          </div>
          <div className="flex gap-2">
            <button type="button" className={btn.chipOn} onClick={() => setSheet('restock')}>
              ＋ Restock
            </button>
            <button type="button" className={btn.chip} onClick={() => setSheet('adjust')}>
              Adjust
            </button>
          </div>
        </div>
      )}

      <Field label="Name *" error={errors.name}>
        <input value={form.name} onChange={update('name')} className={highlight('name')} />
      </Field>
      {similar.length > 0 && (
        <Notice tone="warn">
          <b>Already in your products:</b>
          {similar.map((match) => (
            <Link
              key={match.id}
              href={`/products/${match.id}`}
              className="flex justify-between py-1"
            >
              <span>{match.name}</span>
              <span>Open ›</span>
            </Link>
          ))}
        </Notice>
      )}

      <div className="flex gap-2">
        <Field
          label="Price ₱ *"
          error={errors.price}
          hint={changed('price') && product ? `was ${formatPesos(product.price)}` : undefined}
        >
          <input
            value={form.price}
            inputMode="decimal"
            onChange={update('price')}
            className={highlight('price', belowCost)}
          />
        </Field>
        <Field
          label="Cost ₱"
          error={errors.cost}
          hint={
            changed('cost') && product?.cost != null
              ? `was ${formatPesos(product.cost)}`
              : undefined
          }
        >
          <input
            value={form.cost}
            inputMode="decimal"
            onChange={update('cost')}
            className={highlight('cost')}
          />
        </Field>
      </div>
      {belowCost && (
        <Notice tone="bad">
          ⚠ Price is <b>{formatPesos(cost - price)} below cost</b>. You will lose money on every
          sale. Typo?
        </Notice>
      )}

      <div className="flex gap-2">
        {!editing && (
          <Field label="Starting stock" error={errors.startingStock}>
            <input
              value={form.startingStock}
              inputMode="numeric"
              onChange={update('startingStock')}
              className={highlight('startingStock')}
            />
          </Field>
        )}
        <Field label="Low stock at" error={errors.lowStockAt}>
          <input
            value={form.lowStockAt}
            inputMode="numeric"
            onChange={update('lowStockAt')}
            className={highlight('lowStockAt')}
          />
        </Field>
      </div>
      <Field label="Pack size (optional)" error={errors.packSize}>
        <input
          value={form.packSize}
          inputMode="numeric"
          placeholder="e.g. 20 for cigarettes"
          onChange={update('packSize')}
          className={highlight('packSize')}
        />
      </Field>
      <label className="flex items-center justify-between py-1">
        <span>⭐ Show in favorites</span>
        <input
          type="checkbox"
          checked={form.favorite}
          onChange={update('favorite')}
          className="h-6 w-6 accent-brand"
        />
      </label>

      {saveError && <Notice tone="bad">{saveError}</Notice>}
      <button type="button" className={`${btn.primary} mt-auto`} disabled={saving} onClick={save}>
        {editing ? 'Save changes' : 'Save product'}
      </button>
      {product?.active && (
        <button
          type="button"
          className="p-2 text-center font-semibold text-red-600"
          onClick={() => setSheet('stop')}
        >
          Stop selling this product
        </button>
      )}
      {product && !product.active && (
        <button type="button" className={btn.ghost} disabled={saving} onClick={turnOnAgain}>
          Turn on again
        </button>
      )}

      {product && sheet === 'restock' && (
        <RestockSheet
          product={product}
          onClose={() => setSheet(null)}
          onCostSaved={(newCost) =>
            setForm((current) => ({ ...current, cost: toPesosInput(newCost) }))
          }
        />
      )}
      {product && sheet === 'adjust' && (
        <AdjustSheet product={product} onClose={() => setSheet(null)} />
      )}
      {product && sheet === 'stop' && (
        <ConfirmSheet
          title={`Stop selling ${product.name}?`}
          message={`It will be hidden from the Sell screen and product list. Past sales stay in your reports.${
            product.stock > 0
              ? ` ${product.stock} still in stock. They won't be sellable until you turn it back on.`
              : ''
          }`}
          confirmLabel="Stop selling"
          danger
          onConfirm={async () => {
            await setProductActive(db, product.id, false)
            navigate('/products', { replace: true })
          }}
          onClose={() => setSheet(null)}
        />
      )}
    </Screen>
  )
}
