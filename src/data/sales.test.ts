import { describe, expect, test } from 'vitest'
import { addToCart } from '../domain/cart'
import { expectStockMatchesMoves, freshDb, sampleProduct } from '../test/helpers'
import { ValidationError } from '../validation'
import { addProduct, updateProduct } from './products'
import { checkout, salesBetween, voidSale } from './sales'

async function setup() {
  const db = freshDb()
  const coke = await addProduct(db, sampleProduct({ startingStock: 10 }))
  const marlboro = await addProduct(
    db,
    sampleProduct({ name: 'Marlboro Red', price: 900, cost: 825, packSize: 20, startingStock: 46 }),
  )
  return { db, coke, marlboro }
}

describe('checkout', () => {
  test('saves a cash sale with its items and deducts stock', async () => {
    const { db, coke, marlboro } = await setup()
    const cart = addToCart(addToCart([], coke, 1), marlboro, 20)
    const sale = await checkout(db, { cart, payment: 'cash', cashReceived: 30000 })

    expect(sale).toMatchObject({
      payment: 'cash',
      total: 7500 + 18000,
      cashReceived: 30000,
      customerId: null,
      voidedAt: null,
    })
    expect(await db.saleItems.where('saleId').equals(sale.id).toArray()).toHaveLength(2)
    expect((await db.products.get(coke.id))?.stock).toBe(9)
    expect((await db.products.get(marlboro.id))?.stock).toBe(26)
    expect(await db.stockMoves.where('saleId').equals(sale.id).toArray()).toHaveLength(2)
    await expectStockMatchesMoves(db)
  })

  test('rejects cash less than the total and saves nothing', async () => {
    const { db, coke } = await setup()
    const cart = addToCart([], coke, 1)
    await expect(
      checkout(db, { cart, payment: 'cash', cashReceived: 5000 }),
    ).rejects.toBeInstanceOf(ValidationError)
    expect(await db.sales.count()).toBe(0)
  })

  test('rejects an empty cart', async () => {
    const { db } = await setup()
    await expect(checkout(db, { cart: [], payment: 'cash', cashReceived: 0 })).rejects.toThrow(
      'Cart is empty',
    )
  })

  test('rejects utang for an unknown customer and saves nothing', async () => {
    const { db, coke } = await setup()
    const cart = addToCart([], coke, 1)
    await expect(checkout(db, { cart, payment: 'utang', customerId: 'missing' })).rejects.toThrow(
      'Customer not found',
    )
    expect(await db.sales.count()).toBe(0)
  })

  test('a failure part-way through leaves nothing behind', async () => {
    const { db, coke } = await setup()
    const ghost = { id: 'deleted-product', name: 'Ghost', price: 100, cost: null }
    const cart = addToCart(addToCart([], coke, 1), ghost, 1)

    await expect(checkout(db, { cart, payment: 'cash', cashReceived: 10000 })).rejects.toThrow(
      'Product not found',
    )
    expect(await db.sales.count()).toBe(0)
    expect(await db.saleItems.count()).toBe(0)
    expect((await db.products.get(coke.id))?.stock).toBe(10)
    await expectStockMatchesMoves(db)
  })

  test('allows stock to go negative', async () => {
    const { db, coke } = await setup()
    await checkout(db, { cart: addToCart([], coke, 12), payment: 'cash', cashReceived: 90000 })
    expect((await db.products.get(coke.id))?.stock).toBe(-2)
  })

  test('keeps the price paid even after the product price changes', async () => {
    const { db, coke } = await setup()
    const sale = await checkout(db, {
      cart: addToCart([], coke, 1),
      payment: 'cash',
      cashReceived: 7500,
    })
    await updateProduct(db, coke.id, sampleProduct({ price: 8000 }))

    const [item] = await db.saleItems.where('saleId').equals(sale.id).toArray()
    expect(item.price).toBe(7500)
  })
})

describe('voidSale', () => {
  test('returns stock, marks the sale voided and keeps the record', async () => {
    const { db, coke } = await setup()
    const sale = await checkout(db, {
      cart: addToCart([], coke, 3),
      payment: 'cash',
      cashReceived: 22500,
    })
    await voidSale(db, sale.id)

    expect((await db.products.get(coke.id))?.stock).toBe(10)
    expect((await db.sales.get(sale.id))?.voidedAt).not.toBeNull()
    expect(
      (await db.stockMoves.where('saleId').equals(sale.id).toArray()).map((m) => m.reason).sort(),
    ).toEqual(['sale', 'void'])
    await expectStockMatchesMoves(db)
  })

  test('cannot void the same sale twice', async () => {
    const { db, coke } = await setup()
    const sale = await checkout(db, {
      cart: addToCart([], coke, 1),
      payment: 'cash',
      cashReceived: 7500,
    })
    await voidSale(db, sale.id)
    await expect(voidSale(db, sale.id)).rejects.toBeInstanceOf(ValidationError)
    await expect(voidSale(db, sale.id)).rejects.toThrow('already voided')
  })

  test("only today's sales can be voided", async () => {
    const { db, coke } = await setup()
    const sale = await checkout(db, {
      cart: addToCart([], coke, 1),
      payment: 'cash',
      cashReceived: 7500,
    })
    await db.sales.update(sale.id, { createdAt: '2026-10-11T15:59:00.000Z' }) // Oct 11, 11:59 PM
    // One minute later it is Oct 12 in Manila, so the sale is no longer today's.
    await expect(voidSale(db, sale.id, new Date('2026-10-11T16:00:00Z'))).rejects.toThrow(
      "Only today's sales",
    )
    // Earlier the same evening (Oct 11, 6 PM) it can still be voided.
    await expect(voidSale(db, sale.id, new Date('2026-10-11T10:00:00Z'))).resolves.toBeUndefined()
  })
})

describe('salesBetween', () => {
  test('returns sales in the range with their items', async () => {
    const { db, coke } = await setup()
    const inside = await checkout(db, {
      cart: addToCart([], coke, 1),
      payment: 'cash',
      cashReceived: 7500,
    })
    const outside = await checkout(db, {
      cart: addToCart([], coke, 1),
      payment: 'cash',
      cashReceived: 7500,
    })
    await db.sales.update(inside.id, { createdAt: '2026-10-12T02:00:00.000Z' })
    await db.sales.update(outside.id, { createdAt: '2026-10-12T16:00:00.000Z' })

    const result = await salesBetween(
      db,
      new Date('2026-10-11T16:00:00Z'),
      new Date('2026-10-12T16:00:00Z'),
    )
    expect(result.sales.map((s) => s.id)).toEqual([inside.id])
    expect(result.items.map((i) => i.saleId)).toEqual([inside.id])
  })
})
