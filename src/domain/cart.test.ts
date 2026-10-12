import { describe, expect, test } from 'vitest'
import { addToCart, cartPieces, cartTotal, changeDue, setQty, type Cart } from './cart'

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

  test('totals price times quantity and counts pieces', () => {
    const cart = addToCart(addToCart([], coke, 1), marlboro, 3)
    expect(cartTotal(cart)).toBe(7500 + 2700)
    expect(cartPieces(cart)).toBe(4)
  })

  test('changeDue returns change, or null when cash is short', () => {
    expect(changeDue(12500, 20000)).toBe(7500)
    expect(changeDue(12500, 12500)).toBe(0)
    expect(changeDue(12500, 10000)).toBeNull()
  })
})
