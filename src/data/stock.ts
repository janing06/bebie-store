import { newId, nowIso, type AdjustReason, type StockReason, type StoreDb } from '../db'
import { divideRoundHalfUp, type Centavos } from '../money'
import { ValidationError, isWholeNumber } from '../validation'

/**
 * Records one stock change and updates the product's running count.
 * Must run inside a transaction that includes `products` and `stockMoves`.
 */
export async function moveStock(
  db: StoreDb,
  productId: string,
  change: number,
  reason: StockReason,
  links: { saleId?: string | null; note?: string | null } = {},
): Promise<void> {
  if (!Number.isInteger(change) || change === 0) throw new Error(`Invalid stock change: ${change}`)
  const product = await db.products.get(productId)
  if (!product) throw new Error(`Product not found: ${productId}`)
  const at = nowIso()
  await db.stockMoves.add({
    id: newId(),
    productId,
    change,
    reason,
    saleId: links.saleId ?? null,
    note: links.note ?? null,
    createdAt: at,
  })
  await db.products.update(productId, { stock: product.stock + change, updatedAt: at })
}

export async function restock(
  db: StoreDb,
  productId: string,
  pieces: number,
  newCostPerPiece: Centavos | null,
): Promise<void> {
  if (!isWholeNumber(pieces, 1)) throw new ValidationError({ pieces: 'Add at least 1 piece' })
  if (newCostPerPiece !== null && !isWholeNumber(newCostPerPiece)) {
    throw new ValidationError({ cost: 'Cost must be zero or more' })
  }
  await db.transaction('rw', db.products, db.stockMoves, async () => {
    await moveStock(db, productId, pieces, 'restock')
    if (newCostPerPiece !== null) await db.products.update(productId, { cost: newCostPerPiece })
  })
}

/** Sets stock to what was actually counted. Does nothing if the count is unchanged. */
export async function adjustStock(
  db: StoreDb,
  productId: string,
  actualCount: number,
  reason: AdjustReason,
): Promise<void> {
  if (!isWholeNumber(actualCount)) {
    throw new ValidationError({ count: 'Count must be zero or more' })
  }
  await db.transaction('rw', db.products, db.stockMoves, async () => {
    const product = await db.products.get(productId)
    if (!product) throw new Error(`Product not found: ${productId}`)
    const change = actualCount - product.stock
    if (change !== 0) await moveStock(db, productId, change, reason)
  })
}

export function costPerPiece(packCost: Centavos, packSize: number): Centavos {
  return divideRoundHalfUp(packCost, packSize)
}
