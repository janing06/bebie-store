import { useLiveQuery } from 'dexie-react-hooks'
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  rectSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ArrowUpDown, GripVertical, Plus, ShoppingCart, ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'wouter'
import { STORE_NAME } from '../brand'
import { useCart } from '../cart-context'
import { loadFavoriteOrder, moveId, orderFavorites, saveFavoriteOrder } from '../data/favorites'
import { matchesSearch } from '../data/products'
import { salesBetween } from '../data/sales'
import { db, type Product } from '../db'
import { addToCart, cartTotal } from '../domain/cart'
import { rangeFor } from '../domain/dates'
import { greeting } from '../domain/messages'
import { summarize } from '../domain/reports'
import { formatPesos, pluralize } from '../money'
import { Screen, SearchInput } from '../ui'
import { btn } from '../ui-kit'
import { PiecePackSheet } from './PiecePackSheet'
import { QuickAddSheet } from './QuickAddSheet'

const TILE =
  'flex min-h-20 select-none flex-col items-center justify-center rounded-xl border border-slate-200 bg-slate-50 p-2 text-center'

function ProductLabel({ product }: { product: Product }) {
  return (
    <>
      <span className="text-sm font-semibold">{product.name}</span>
      <span className="text-sm font-semibold text-brand">
        {formatPesos(product.price)}
        {product.packSize ? '/pc' : ''}
      </span>
    </>
  )
}

function SortableTile({ product }: { product: Product }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: product.id,
  })
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`${TILE} relative touch-none ${isDragging ? 'z-10 shadow-lg' : 'motion-safe:animate-wiggle'}`}
    >
      <GripVertical aria-hidden size={16} className="absolute top-1 right-1 text-slate-400" />
      <ProductLabel product={product} />
    </div>
  )
}

export function SellScreen() {
  const products = useLiveQuery(() => db.products.orderBy('name').toArray(), [])
  const savedOrder = useLiveQuery(() => loadFavoriteOrder(db), [])
  const today = useLiveQuery(() => {
    const { start, end } = rangeFor('today', new Date())
    return salesBetween(db, start, end)
  }, [])
  const { cart, setCart } = useCart()
  const [now] = useState(() => new Date())
  const [search, setSearch] = useState('')
  const [picking, setPicking] = useState<Product | null>(null)
  const [quickAdd, setQuickAdd] = useState(false)
  const [arranging, setArranging] = useState(false)
  const [draft, setDraft] = useState<string[] | null>(null)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const active = (products ?? []).filter((product) => product.active)
  const searching = search.trim() !== ''
  const favorites = orderFavorites(active, draft ?? savedOrder ?? [])
  const shown = searching
    ? active.filter((product) => matchesSearch(product.name, search))
    : favorites
  const others = active.filter((product) => !product.favorite)
  const canArrange = !searching && favorites.length >= 2
  const todayTotal = today ? summarize(today.sales, today.items).salesTotal : 0

  function choose(product: Product) {
    if (product.packSize) setPicking(product)
    else setCart(addToCart(cart, product, 1))
  }

  function finishArranging() {
    setArranging(false)
    setDraft(null)
  }

  function dropped({ active, over }: DragEndEvent) {
    if (!over) return
    const order = moveId(
      favorites.map((product) => product.id),
      String(active.id),
      String(over.id),
    )
    setDraft(order)
    void saveFavoriteOrder(db, order)
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
      <SearchInput
        value={search}
        onChange={setSearch}
        placeholder="Search product…"
        disabled={arranging}
      />
      <div className="flex min-h-11 items-center justify-between">
        <p className="text-xs font-semibold tracking-wide text-slate-500">
          {searching ? 'RESULTS' : arranging ? 'Drag to reorder' : 'FAVORITES'}
        </p>
        {arranging ? (
          <button type="button" onClick={finishArranging} className={btn.chipOn}>
            Done
          </button>
        ) : (
          canArrange && (
            <button
              type="button"
              onClick={() => setArranging(true)}
              className="flex min-h-11 items-center gap-1 px-2 text-sm font-semibold text-brand"
            >
              <ArrowUpDown aria-hidden size={16} />
              Arrange
            </button>
          )
        )}
      </div>
      {arranging ? (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={dropped}>
          <SortableContext
            items={shown.map((product) => product.id)}
            strategy={rectSortingStrategy}
          >
            <div className="grid grid-cols-3 gap-2">
              {shown.map((product) => (
                <SortableTile key={product.id} product={product} />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {shown.map((product) => (
            <button
              key={product.id}
              type="button"
              onClick={() => choose(product)}
              className={`${TILE} transition active:scale-[0.98] active:bg-slate-200`}
            >
              <ProductLabel product={product} />
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
      )}
      {!searching && shown.length === 0 && (
        <p className="text-sm text-slate-500">
          No favorites yet. Turn on "Show in favorites" in Products.
        </p>
      )}
      {!searching && !arranging && others.length > 0 && (
        <>
          <p className="text-xs font-semibold tracking-wide text-slate-500">ALL PRODUCTS</p>
          <div className="divide-y divide-slate-200">
            {others.map((product) => (
              <button
                key={product.id}
                type="button"
                onClick={() => choose(product)}
                className="flex min-h-12 w-full select-none items-center justify-between gap-2 px-1 text-left transition active:bg-slate-100"
              >
                <span className="font-semibold">{product.name}</span>
                <span className="font-semibold text-brand">
                  {formatPesos(product.price)}
                  {product.packSize ? '/pc' : ''}
                </span>
              </button>
            ))}
          </div>
        </>
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
