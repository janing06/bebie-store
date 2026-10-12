import { describe, expect, test } from 'vitest'
import { addToCart, cartTotal, changeDue, setQty, suggestCashAmounts, type Cart } from './cart'

const coke = { id: 'coke', name: 'Coke 1.5L', price: 7500, cost: 6200 }
const marlboro = { id: 'marlboro', name: 'Marlboro Red', price: 900, cost: 825 }

describe('cart', () => {
  test('adds a new line with the product price and cost', () => {
    expect(addToCart([], coke, 1)).toEqual([
      { productId: 'coke', name: 'Coke 1.5L', price: 7500, cost: 6200, qty: 1 },
    ])
  })

  test('adding the same product again increases its quantity', () => {
    const cart = addToCart(addToCart([], marlboro, 3), marlboro, 20)
    expect(cart).toHaveLength(1)
    expect(cart[0].qty).toBe(23)
  })

  test('rejects adding zero or fractional pieces', () => {
    expect(() => addToCart([], coke, 0)).toThrow()
    expect(() => addToCart([], coke, 1.5)).toThrow()
  })

  test('setQty changes a quantity and removes the line at 0', () => {
    const cart: Cart = addToCart(addToCart([], coke, 1), marlboro, 3)
    expect(setQty(cart, 'marlboro', 5)[1].qty).toBe(5)
    expect(setQty(cart, 'marlboro', 0)).toHaveLength(1)
  })

  test('totals price times quantity', () => {
    const cart = addToCart(addToCart([], coke, 1), marlboro, 3)
    expect(cartTotal(cart)).toBe(7500 + 2700)
  })

  test('changeDue returns change, or null when cash is short', () => {
    expect(changeDue(12500, 20000)).toBe(7500)
    expect(changeDue(12500, 12500)).toBe(0)
    expect(changeDue(12500, 10000)).toBeNull()
  })

  test.each([
    [15, [20, 50, 100, 200, 500, 1000]],
    [30, [40, 50, 100, 200, 500, 1000]],
    [123, [125, 130, 140, 150, 200, 500, 1000]],
    [125, [130, 140, 150, 200, 500, 1000]],
    [376, [380, 400, 500, 1000]],
    [1250, [1260, 1300, 1400, 1500, 2000]],
    [12.5, [13, 15, 20, 50, 100, 200, 500, 1000]],
    [1000, []],
    [0, []],
  ])('suggestCashAmounts for ₱%s', (totalPesos, expectedPesos) => {
    expect(suggestCashAmounts(Math.round(totalPesos * 100))).toEqual(
      expectedPesos.map((pesos) => pesos * 100),
    )
  })
})
