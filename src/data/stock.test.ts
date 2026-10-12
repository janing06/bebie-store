import { describe, expect, test } from 'vitest'
import { expectStockMatchesMoves, freshDb, sampleProduct } from '../test/helpers'
import { ValidationError } from '../validation'
import { addProduct } from './products'
import { adjustStock, costPerPiece, restock } from './stock'

describe('restock', () => {
  test('adds pieces as a restock move', async () => {
    const db = freshDb()
    const product = await addProduct(db, sampleProduct({ startingStock: 46 }))
    await restock(db, product.id, 100, null)

    expect((await db.products.get(product.id))?.stock).toBe(146)
    const moves = await db.stockMoves.where('productId').equals(product.id).toArray()
    expect(moves).toContainEqual(expect.objectContaining({ change: 100, reason: 'restock' }))
    await expectStockMatchesMoves(db)
  })

  test('updates the cost per piece when a new cost is given', async () => {
    const db = freshDb()
    const product = await addProduct(db, sampleProduct({ cost: 800 }))
    await restock(db, product.id, 20, 825)
    expect((await db.products.get(product.id))?.cost).toBe(825)
  })

  test('rejects zero pieces', async () => {
    const db = freshDb()
    const product = await addProduct(db, sampleProduct())
    await expect(restock(db, product.id, 0, null)).rejects.toBeInstanceOf(ValidationError)
  })

  test('saves nothing for an unknown product', async () => {
    const db = freshDb()
    await expect(restock(db, 'missing', 5, 100)).rejects.toThrow('Product not found')
    expect(await db.stockMoves.count()).toBe(0)
  })
})

describe('adjustStock', () => {
  test('sets stock to the actual count with the reason', async () => {
    const db = freshDb()
    const product = await addProduct(db, sampleProduct({ startingStock: 3 }))
    await adjustStock(db, product.id, 1, 'missing')

    expect((await db.products.get(product.id))?.stock).toBe(1)
    const moves = await db.stockMoves.where('productId').equals(product.id).toArray()
    expect(moves).toContainEqual(expect.objectContaining({ change: -2, reason: 'missing' }))
    await expectStockMatchesMoves(db)
  })

  test('can raise stock after a recount', async () => {
    const db = freshDb()
    const product = await addProduct(db, sampleProduct({ startingStock: 3 }))
    await adjustStock(db, product.id, 7, 'recount')
    expect((await db.products.get(product.id))?.stock).toBe(7)
  })

  test('does nothing when the count is unchanged', async () => {
    const db = freshDb()
    const product = await addProduct(db, sampleProduct({ startingStock: 3 }))
    await adjustStock(db, product.id, 3, 'recount')
    expect(await db.stockMoves.count()).toBe(1)
  })

  test('rejects a negative count', async () => {
    const db = freshDb()
    const product = await addProduct(db, sampleProduct())
    await expect(adjustStock(db, product.id, -1, 'recount')).rejects.toBeInstanceOf(ValidationError)
  })
})

describe('costPerPiece', () => {
  test('splits a pack cost per piece, rounding half up', () => {
    expect(costPerPiece(16500, 20)).toBe(825)
    expect(costPerPiece(10000, 12)).toBe(833)
  })
})
