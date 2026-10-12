import { newId, nowIso, type StockReason, type StoreDb } from '../db'

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
