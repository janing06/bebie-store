import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Link } from 'wouter'
import { isLowStock, matchesSearch, setProductActive } from '../data/products'
import { db, type Product } from '../db'
import { formatDay } from '../domain/dates'
import { formatPesos } from '../money'
import { Screen } from '../ui'
import { btn, errorMessage, inputClass } from '../ui-kit'

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
        <Link href="/import" className="text-sm">
          Import
        </Link>
      }
      footer={
        <Link href="/products/new" className={`${btn.primary} mx-3 mb-2 block`}>
          ＋ Add product
        </Link>
      }
    >
      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="🔍 Search product…"
        className={inputClass()}
      />
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
      <Link href={`/products/${product.id}`} className="flex items-center justify-between py-3">
        <span>
          <b>{product.name}</b>
          <span className="block text-xs text-slate-500">
            {formatPesos(product.price)}
            {product.packSize ? `/pc · pack ${product.packSize}` : ''}
            {product.cost !== null ? ` · cost ${formatPesos(product.cost)}` : ''}
          </span>
        </span>
        <span className={low ? 'font-bold text-red-600' : ''}>
          {product.stock}
          {product.packSize ? ' pcs' : ''}
          {low ? ' ⚠' : ''} ›
        </span>
      </Link>
    </li>
  )
}

function StoppedRow({ product }: { product: Product }) {
  async function turnOn() {
    try {
      await setProductActive(db, product.id, true)
    } catch (caught) {
      window.alert(errorMessage(caught))
    }
  }

  return (
    <li className="flex items-center justify-between py-3">
      <Link href={`/products/${product.id}`} className="opacity-60">
        <b>{product.name}</b>
        <span className="block text-xs text-slate-500">
          stopped {formatDay(product.updatedAt)} · {product.stock} in stock
        </span>
      </Link>
      <button type="button" className="font-semibold text-brand" onClick={turnOn}>
        Turn on
      </button>
    </li>
  )
}
