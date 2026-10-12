import { describe, expect, test } from 'vitest'
import type { Sale, SaleItem } from '../db'
import { summarize } from './reports'

function sale(id: string, overrides: Partial<Sale> = {}): Sale {
  return {
    id,
    createdAt: '2026-10-12T02:00:00.000Z',
    payment: 'cash',
    customerId: null,
    total: 0,
    cashReceived: 0,
    voidedAt: null,
    ...overrides,
  }
}

function item(
  saleId: string,
  productId: string,
  qty: number,
  price: number,
  cost: number | null,
): SaleItem {
  return { id: crypto.randomUUID(), saleId, productId, name: productId, qty, price, cost }
}

describe('summarize', () => {
  const sales = [
    sale('a', { total: 7500 + 2700 }),
    sale('b', { total: 1800, payment: 'utang', customerId: 'nena', cashReceived: null }),
    sale('c', { total: 7500, voidedAt: '2026-10-12T03:00:00.000Z' }),
  ]
  const items = [
    item('a', 'coke', 1, 7500, 6200),
    item('a', 'marlboro', 3, 900, 825),
    item('b', 'canton', 1, 1800, null),
    item('c', 'coke', 1, 7500, 6200),
  ]

  test('totals unvoided sales, split by payment', () => {
    expect(summarize(sales, items)).toMatchObject({
      salesTotal: 12000,
      salesCount: 2,
      cash: 10200,
      utang: 1800,
    })
  })

  test('computes profit from items with a cost and counts the rest', () => {
    const summary = summarize(sales, items)
    expect(summary.profit).toBe(1300 + 3 * 75)
    expect(summary.unknownCostItems).toBe(1)
  })

  test('ranks best sellers by sales amount, excluding voided sales', () => {
    expect(summarize(sales, items).bestSellers).toEqual([
      { productId: 'coke', name: 'coke', qty: 1, total: 7500 },
      { productId: 'marlboro', name: 'marlboro', qty: 3, total: 2700 },
      { productId: 'canton', name: 'canton', qty: 1, total: 1800 },
    ])
  })

  test('is all zeros with no sales', () => {
    expect(summarize([], [])).toEqual({
      salesTotal: 0,
      salesCount: 0,
      cash: 0,
      utang: 0,
      profit: 0,
      unknownCostItems: 0,
      bestSellers: [],
    })
  })
})
