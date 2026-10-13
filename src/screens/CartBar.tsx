import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronRight, ShoppingCart, Trash2 } from 'lucide-react'
import { useRef, useState, type PointerEvent } from 'react'
import { Link } from 'wouter'
import { addCartSwipe, loadCartSwipes } from '../data/preferences'
import { db } from '../db'
import { cartTotal, type Cart } from '../domain/cart'
import { formatPesos, pluralize } from '../money'

const REVEAL = 64 // px the bar rests open; the trash circle lines up with the bar's right edge
const MAX_SCALE = 1.4
const CLEAR_AT = 0.25 // share of the bar width; letting go past it clears
const HINT_SWIPES = 3
const FLY_MS = 200
export const UNDO_MS = 5000 // matches --animate-shrink in index.css

interface Drag {
  startX: number
  base: number
  width: number
  offset: number
  moved: boolean
  armed: boolean
}

/**
 * The Sell screen's cart bar. A tap opens the cart. Swiping left shows a trash circle that
 * grows with the swipe; letting go past a quarter of the bar clears the cart.
 */
export function CartBar({ cart, onClear }: { cart: Cart; onClear: () => void }) {
  const drag = useRef<Drag | null>(null)
  const skipClick = useRef(false)
  const [offset, setOffset] = useState(0)
  const [width, setWidth] = useState(0)
  const [dragging, setDragging] = useState(false)
  const swipes = useLiveQuery(() => loadCartSwipes(db), [])
  const total = cartTotal(cart)

  // Adding a product while the bar is open slides it closed.
  const [shownTotal, setShownTotal] = useState(total)
  if (total !== shownTotal) {
    setShownTotal(total)
    setOffset(0)
  }

  const clearAt = width * CLEAR_AT
  const armed = width > 0 && -offset > clearAt
  // Normal size at the reveal point, then growing to its biggest exactly at the clear point.
  const scale =
    -offset <= REVEAL
      ? -offset / REVEAL
      : Math.min(
          MAX_SCALE,
          1 + ((MAX_SCALE - 1) * (-offset - REVEAL)) / Math.max(1, clearAt - REVEAL),
        )

  function flyAway(barWidth: number) {
    setOffset(-(barWidth + 40)) // off the left edge of the screen
    setTimeout(onClear, FLY_MS)
  }

  function down(event: PointerEvent<HTMLAnchorElement>) {
    const barWidth = event.currentTarget.offsetWidth
    drag.current = {
      startX: event.clientX,
      base: offset,
      width: barWidth,
      offset,
      moved: false,
      armed: false,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
    setWidth(barWidth)
    setDragging(true)
  }

  function move(event: PointerEvent<HTMLAnchorElement>) {
    const current = drag.current
    if (!current) return
    const dx = event.clientX - current.startX
    if (Math.abs(dx) > 6) current.moved = true
    current.offset = Math.min(0, Math.max(-current.width, current.base + dx))
    const nowArmed = -current.offset > current.width * CLEAR_AT
    if (nowArmed && !current.armed) navigator.vibrate?.(15)
    current.armed = nowArmed
    setOffset(current.offset)
  }

  function up() {
    const current = drag.current
    drag.current = null
    setDragging(false)
    if (!current) return
    // A swipe, or a tap that closes the open bar, must not also open the cart.
    skipClick.current = current.moved || current.base !== 0
    if (!current.moved) {
      setOffset(0)
      return
    }
    const rest = current.armed ? 'clear' : -current.offset > REVEAL / 2 ? 'open' : 'closed'
    if (rest !== 'closed') void addCartSwipe(db)
    if (rest === 'clear') flyAway(current.width)
    else setOffset(rest === 'open' ? -REVEAL : 0)
  }

  function cancel() {
    drag.current = null
    setDragging(false)
    setOffset(0)
  }

  const motion = dragging ? '' : 'transition duration-200 ease-out'

  return (
    <div className="px-3 pb-2">
      <div className="relative">
        <button
          type="button"
          aria-label="Clear cart"
          tabIndex={offset === 0 ? -1 : 0}
          className="absolute inset-y-0 right-0 flex w-16 items-center justify-end"
          onClick={() => flyAway(width)}
        >
          <span
            className={`flex h-12 w-12 origin-right items-center justify-center rounded-full bg-red-600 text-white ${motion} ${armed ? 'ring-6 ring-red-600/20' : ''}`}
            style={{ transform: `scale(${scale})` }}
          >
            <Trash2 aria-hidden size={24} />
          </span>
        </button>
        <Link
          href="/checkout"
          draggable={false}
          className={`relative flex touch-pan-y select-none justify-between rounded-xl bg-brand p-4 text-lg font-bold text-white active:opacity-80 ${motion}`}
          style={{ transform: `translateX(${offset}px)` }}
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={cancel}
          onClick={(event) => {
            if (!skipClick.current) return
            skipClick.current = false
            event.preventDefault()
          }}
        >
          <span className="flex items-center gap-2">
            <ShoppingCart aria-hidden />
            {pluralize(cart.length, 'item')}
          </span>
          <span className="flex items-center gap-1">
            {formatPesos(total)}
            <ChevronRight aria-hidden />
          </span>
        </Link>
      </div>
      {swipes !== undefined && swipes < HINT_SWIPES && (
        <p className="pt-1 text-center text-xs text-slate-500">← Swipe left to clear</p>
      )}
    </div>
  )
}

/** Shown after the cart is cleared, until Undo or UNDO_MS passes. */
export function UndoClear({ cleared, onUndo }: { cleared: Cart; onUndo: () => void }) {
  return (
    <div className="relative mx-3 mb-2 flex items-center justify-between overflow-hidden rounded-xl bg-slate-800 py-2 pr-2 pl-4 text-white">
      <span>
        Cleared {pluralize(cleared.length, 'item')} · {formatPesos(cartTotal(cleared))}
      </span>
      <button
        type="button"
        className="min-h-11 select-none px-3 font-bold uppercase text-teal-300 active:opacity-60"
        onClick={onUndo}
      >
        Undo
      </button>
      <div
        aria-hidden
        className="absolute bottom-0 left-0 h-1 w-full origin-left animate-shrink bg-teal-300"
      />
    </div>
  )
}
