import { useLiveQuery } from 'dexie-react-hooks'
import { Plus, ShoppingCart, ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'wouter'
import { STORE_NAME } from '../brand'
import { useCart } from '../cart-context'
import { matchesSearch } from '../data/products'
import { salesBetween } from '../data/sales'
import { db, type Product } from '../db'
import { addToCart, cartTotal } from '../domain/cart'
import { rangeFor } from '../domain/dates'
import { greeting } from '../domain/messages'
import { summarize } from '../domain/reports'
import { formatPesos, pluralize } from '../money'
import { Screen, SearchInput } from '../ui'
import { PiecePackSheet } from './PiecePackSheet'
import { QuickAddSheet } from './QuickAddSheet'

export function SellScreen() {
  const products = useLiveQuery(() => db.products.orderBy('name').toArray(), [])
  const today = useLiveQuery(() => {
    const { start, end } = rangeFor('today', new Date())
    return salesBetween(db, start, end)
  }, [])
  const { cart, setCart } = useCart()
  const [now] = useState(() => new Date())
  const [search, setSearch] = useState('')
  const [picking, setPicking] = useState<Product | null>(null)
  const [quickAdd, setQuickAdd] = useState(false)

  const active = (products ?? []).filter((product) => product.active)
  const searching = search.trim() !== ''
  const shown = searching
    ? active.filter((product) => matchesSearch(product.name, search))
    : active.filter((product) => product.favorite)
  const todayTotal = today ? summarize(today.sales, today.items).salesTotal : 0

  function choose(product: Product) {
    if (product.packSize) setPicking(product)
    else setCart(addToCart(cart, product, 1))
  }

  return (
    <Screen
      title={STORE_NAME}
      subtitle={`${greeting(now)} 👋 · Today ${formatPesos(todayTotal)}`}
      nav
      footer={
        cart.length > 0 && (
          <Link
            href="/checkout"
            className="mx-3 mb-2 flex select-none justify-between rounded-xl bg-brand p-4 text-lg font-bold text-white transition active:scale-[0.98] active:opacity-80"
          >
            <span className="flex items-center gap-2">
              <ShoppingCart aria-hidden />
              {pluralize(cart.length, 'item')}
            </span>
            <span className="flex items-center gap-1">
              {formatPesos(cartTotal(cart))}
              <ChevronRight aria-hidden />
            </span>
          </Link>
        )
      }
    >
      <SearchInput value={search} onChange={setSearch} placeholder="Search product…" />
      <p className="text-xs font-semibold tracking-wide text-slate-500">
        {searching ? 'RESULTS' : 'FAVORITES'}
      </p>
      <div className="grid grid-cols-3 gap-2">
        {shown.map((product) => (
          <button
            key={product.id}
            type="button"
            onClick={() => choose(product)}
            className="flex min-h-20 select-none flex-col items-center justify-center rounded-xl border border-slate-200 bg-slate-50 p-2 text-center transition active:scale-[0.98] active:bg-slate-200"
          >
            <span className="text-sm font-semibold">{product.name}</span>
            <span className="text-sm font-semibold text-brand">
              {formatPesos(product.price)}
              {product.packSize ? '/pc' : ''}
            </span>
          </button>
        ))}
        <button
          type="button"
          onClick={() => setQuickAdd(true)}
          className="flex min-h-20 select-none flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-brand p-2 text-sm font-semibold text-brand"
        >
          <Plus aria-hidden size={20} />
          Quick add
        </button>
      </div>
      {!searching && shown.length === 0 && (
        <p className="text-sm text-slate-500">
          No favorites yet. Search for a product, or turn on "Show in favorites" in Products.
        </p>
      )}
      {picking?.packSize && (
        <PiecePackSheet
          product={picking}
          packSize={picking.packSize}
          onAdd={(count) => {
            setCart(addToCart(cart, picking, count))
            setPicking(null)
          }}
          onClose={() => setPicking(null)}
        />
      )}
      {quickAdd && (
        <QuickAddSheet
          initialName={search}
          onAdded={(product) => {
            setCart(addToCart(cart, product, 1))
            setQuickAdd(false)
            setSearch('')
          }}
          onClose={() => setQuickAdd(false)}
        />
      )}
    </Screen>
  )
}
