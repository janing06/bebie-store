import { useState } from 'react'
import type { Product } from '../db'
import { formatPesos, pluralize } from '../money'
import { Sheet, Stepper } from '../ui'
import { btn } from '../ui-kit'

export function PiecePackSheet({
  product,
  packSize,
  onAdd,
  onClose,
}: {
  product: Product
  packSize: number
  onAdd: (pieces: number) => void
  onClose: () => void
}) {
  const [unit, setUnit] = useState<'piece' | 'pack'>('piece')
  const [count, setCount] = useState<number | null>(1)
  const pieces = count === null ? 0 : unit === 'pack' ? count * packSize : count

  return (
    <Sheet title={product.name} onClose={onClose}>
      <p className="text-sm text-slate-500">Stock: {pluralize(product.stock, 'pc')}</p>
      <div className="flex gap-2">
        {(['piece', 'pack'] as const).map((option) => (
          <button
            key={option}
            type="button"
            className={`${unit === option ? btn.primary : btn.ghost} flex-1`}
            onClick={() => setUnit(option)}
          >
            {option === 'piece' ? 'Piece' : `Pack (${packSize})`}
            <span className="block text-sm font-normal">
              {formatPesos(option === 'piece' ? product.price : product.price * packSize)}
            </span>
          </button>
        ))}
      </div>
      <Stepper value={count} onChange={setCount} />
      <button
        type="button"
        className={btn.primary}
        disabled={count === null}
        onClick={() => onAdd(pieces)}
      >
        Add {formatPesos(product.price * pieces)}
      </button>
    </Sheet>
  )
}
