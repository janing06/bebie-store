import { expect } from 'vitest'
import type { NewProductInput } from '../data/products'
import { StoreDb } from '../db'

export function freshDb(): StoreDb {
  return new StoreDb(`test-${crypto.randomUUID()}`)
}

export function sampleProduct(overrides: Partial<NewProductInput> = {}): NewProductInput {
  return {
    name: 'Coke 1.5L',
    price: 7500,
    cost: 6200,
    lowStockAt: null,
    packSize: null,
    favorite: false,
    startingStock: 10,
    ...overrides,
  }
}

/** The running stock count must always equal the sum of its history. */
export async function expectStockMatchesMoves(db: StoreDb): Promise<void> {
  const [products, moves] = await Promise.all([db.products.toArray(), db.stockMoves.toArray()])
  for (const product of products) {
    const sum = moves
      .filter((move) => move.productId === product.id)
      .reduce((total, move) => total + move.change, 0)
    expect(product.stock, product.name).toBe(sum)
  }
}
