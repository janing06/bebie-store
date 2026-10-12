import { describe, expect, test } from 'vitest'
import type { Product, Sale, SaleItem } from '../db'
import { soldQuantities, sortProducts } from './product-sort'

function sale(id: string, voidedAt: string | null = null): Sale {
  return {
    id,
    createdAt: '2026-10-12T02:00:00.000Z',
    payment: 'cash',
    customerId: null,
    total: 0,
    cashReceived: 0,
    voidedAt,
  }
}

function item(saleId: string, productId: string, qty: number): SaleItem {
  return {
    id: crypto.randomUUID(),
    saleId,
    productId,
    name: productId,
    qty,
    price: 100,
    cost: null,
  }
}

function product(id: string, name: string): Product {
  return { id, name } as Product
}

describe('soldQuantities', () => {
  test('sums qty across sales', () => {
    const sold = soldQuantities(
      [sale('s1'), sale('s2')],
      [item('s1', 'a', 2), item('s2', 'a', 3), item('s2', 'b', 1)],
    )
    expect(sold).toEqual(
      new Map([
        ['a', 5],
        ['b', 1],
      ]),
    )
  })

  test('ignores voided sales', () => {
    const sold = soldQuantities(
      [sale('s1'), sale('s2', '2026-10-12T03:00:00.000Z')],
      [item('s1', 'a', 2), item('s2', 'a', 9)],
    )
    expect(sold.get('a')).toBe(2)
  })
})

describe('sortProducts', () => {
  const products = [product('1', 'banana'), product('2', 'Cola'), product('3', 'Apple')]

  test("'az' sorts by name, ignoring case", () => {
    expect(sortProducts(products, 'az', new Map()).map((p) => p.name)).toEqual([
      'Apple',
      'banana',
      'Cola',
    ])
  })

  test("'best' sorts by sold descending, ties and zeros A-Z", () => {
    const sold = new Map([
      ['1', 4],
      ['2', 4],
    ])
    expect(sortProducts(products, 'best', sold).map((p) => p.name)).toEqual([
      'banana',
      'Cola',
      'Apple',
    ])
  })

  test('does not mutate the input', () => {
    const copy = [...products]
    sortProducts(products, 'az', new Map())
    expect(products).toEqual(copy)
  })
})
