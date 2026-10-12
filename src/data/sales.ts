import { newId, nowIso, type Sale, type SaleItem, type StoreDb } from '../db'
import { cartTotal, type Cart } from '../domain/cart'
import { isSameLocalDay } from '../domain/dates'
import type { Centavos } from '../money'
import { ValidationError } from '../validation'
import { moveStock } from './stock'

export type CheckoutInput =
  | { cart: Cart; payment: 'cash'; cashReceived: Centavos }
  | { cart: Cart; payment: 'utang'; customerId: string }

/** Saves the sale, its items and the stock changes together, or nothing at all. */
export async function checkout(db: StoreDb, input: CheckoutInput): Promise<Sale> {
  if (input.cart.length === 0) throw new Error('Cart is empty')
  const total = cartTotal(input.cart)
  if (input.payment === 'cash' && input.cashReceived < total) {
    throw new ValidationError({ cashReceived: 'Cash received is less than the total' })
  }
  const sale: Sale = {
    id: newId(),
    createdAt: nowIso(),
    payment: input.payment,
    customerId: input.payment === 'utang' ? input.customerId : null,
    total,
    cashReceived: input.payment === 'cash' ? input.cashReceived : null,
    voidedAt: null,
  }
  await db.transaction(
    'rw',
    [db.sales, db.saleItems, db.stockMoves, db.products, db.customers],
    async () => {
      if (input.payment === 'utang' && !(await db.customers.get(input.customerId))) {
        throw new Error(`Customer not found: ${input.customerId}`)
      }
      await db.sales.add(sale)
      for (const line of input.cart) {
        await db.saleItems.add({
          id: newId(),
          saleId: sale.id,
          productId: line.productId,
          name: line.name,
          qty: line.qty,
          price: line.price,
          cost: line.cost,
        })
        await moveStock(db, line.productId, -line.qty, 'sale', { saleId: sale.id })
      }
    },
  )
  return sale
}

export async function voidSale(db: StoreDb, saleId: string, now = new Date()): Promise<void> {
  await db.transaction('rw', [db.sales, db.saleItems, db.stockMoves, db.products], async () => {
    const sale = await db.sales.get(saleId)
    if (!sale) throw new Error(`Sale not found: ${saleId}`)
    if (sale.voidedAt !== null) throw new ValidationError({ sale: 'This sale is already voided' })
    if (!isSameLocalDay(new Date(sale.createdAt), now)) {
      throw new ValidationError({ sale: "Only today's sales can be voided" })
    }
    const items = await db.saleItems.where('saleId').equals(saleId).toArray()
    for (const item of items) await moveStock(db, item.productId, item.qty, 'void', { saleId })
    await db.sales.update(saleId, { voidedAt: now.toISOString() })
  })
}

/** All sales (voided included) with `start <= createdAt < end`, plus their items. */
export async function salesBetween(
  db: StoreDb,
  start: Date,
  end: Date,
): Promise<{ sales: Sale[]; items: SaleItem[] }> {
  const sales = await db.sales
    .where('createdAt')
    .between(start.toISOString(), end.toISOString(), true, false)
    .toArray()
  const ids = sales.map((sale) => sale.id)
  const items = ids.length > 0 ? await db.saleItems.where('saleId').anyOf(ids).toArray() : []
  return { sales, items }
}
