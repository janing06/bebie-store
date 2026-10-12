import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronRight, Plus, TriangleAlert } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'wouter'
import { isLowStock, matchesSearch, setProductActive } from '../data/products'
import { db, type Product } from '../db'
import { formatDay } from '../domain/dates'
import { formatPesos } from '../money'
import { Notice, Screen, SearchInput } from '../ui'
import { ROW, btn, errorMessage } from '../ui-kit'

type Filter = 'all' | 'low' | 'stopped'
const FILTER_LABELS: Record<Filter, string> = { all: 'All', low: 'Low stock', stopped: 'Stopped' }

export function ProductsScreen() {
  const products = useLiveQuery(() => db.products.orderBy('name').toArray(), [])
  const [filter, setFilter] = useState<Filter>('all')
  const [search, setSearch] = useState('')

  const all = products ?? []
  const lists: Record<Filter, Product[]> = {
    all: all.filter((product) => product.active),
    low: all.filter((product) => product.active && isLowStock(product)),
    stopped: all.filter((product) => !product.active),
  }
  const shown = lists[filter].filter((product) => matchesSearch(product.name, search))

  return (
    <Screen
      title="Products"
      nav
      action={
        <Link
          href="/import"
          className="flex min-h-11 select-none items-center px-2 text-sm active:opacity-60"
        >
          Import
        </Link>
      }
      footer={
        <Link
          href="/products/new"
          className={`${btn.primary} mx-3 mb-2 flex items-center justify-center gap-2`}
        >
          <Plus aria-hidden size={20} />
          Add product
        </Link>
      }
    >
      <SearchInput value={search} onChange={setSearch} placeholder="Search product…" />
      <div className="flex gap-2">
        {(Object.keys(FILTER_LABELS) as Filter[]).map((option) => (
          <button
            key={option}
            type="button"
            className={filter === option ? btn.chipOn : btn.chip}
            onClick={() => setFilter(option)}
          >
            {FILTER_LABELS[option]} {lists[option].length}
          </button>
        ))}
      </div>
      <ul className="divide-y divide-slate-100">
        {shown.map((product) =>
          product.active ? (
            <ActiveRow key={product.id} product={product} />
          ) : (
            <StoppedRow key={product.id} product={product} />
          ),
        )}
      </ul>
      {shown.length === 0 && <p className="text-sm text-slate-500">No products here.</p>}
    </Screen>
  )
}

function ActiveRow({ product }: { product: Product }) {
  const low = isLowStock(product)
  return (
    <li>
      <Link href={`/products/${product.id}`} className={ROW}>
        <span>
          <b>{product.name}</b>
          <span className="block text-xs text-slate-500">
            {formatPesos(product.price)}
            {product.packSize ? `/pc · pack ${product.packSize}` : ''}
            {product.cost !== null ? ` · cost ${formatPesos(product.cost)}` : ''}
          </span>
        </span>
        <span className={`flex items-center gap-1 ${low ? 'font-bold text-red-600' : ''}`}>
          {product.stock}
          {product.packSize ? ' pcs' : ''}
          {low && <TriangleAlert aria-hidden size={16} />}
          <ChevronRight aria-hidden size={20} className="text-slate-400" />
        </span>
      </Link>
    </li>
  )
}

function StoppedRow({ product }: { product: Product }) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function turnOn() {
    setSaving(true)
    try {
      await setProductActive(db, product.id, true)
    } catch (caught) {
      setError(errorMessage(caught))
    }
    setSaving(false)
  }

  return (
    <li className="flex min-h-12 flex-wrap items-center justify-between py-3">
      <Link
        href={`/products/${product.id}`}
        className="flex min-h-12 select-none flex-col justify-center opacity-60"
      >
        <b>{product.name}</b>
        <span className="block text-xs text-slate-500">
          stopped {formatDay(product.updatedAt)} · {product.stock} in stock
        </span>
      </Link>
      <button
        type="button"
        className="min-h-11 select-none px-2 font-semibold text-brand active:opacity-60"
        disabled={saving}
        onClick={turnOn}
      >
        Turn on
      </button>
      {error && (
        <div className="w-full pt-2">
          <Notice tone="bad">{error}</Notice>
        </div>
      )}
    </li>
  )
}
