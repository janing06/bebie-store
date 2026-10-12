import type { Centavos } from '../money'

export interface CartLine {
  productId: string
  name: string
  price: Centavos // per piece
  cost: Centavos | null // per piece
  qty: number // pieces
}

export type Cart = readonly CartLine[]

export interface Sellable {
  id: string
  name: string
  price: Centavos
  cost: Centavos | null
}

export function addToCart(cart: Cart, product: Sellable, pieces: number): Cart {
  if (!Number.isInteger(pieces) || pieces < 1) throw new Error(`Cannot add ${pieces} pieces`)
  const existing = cart.find((line) => line.productId === product.id)
  if (existing) return setQty(cart, product.id, existing.qty + pieces)
  return [
    ...cart,
    {
      productId: product.id,
      name: product.name,
      price: product.price,
      cost: product.cost,
      qty: pieces,
    },
  ]
}

export function setQty(cart: Cart, productId: string, qty: number): Cart {
  if (!Number.isInteger(qty)) throw new Error(`Quantity must be whole: ${qty}`)
  if (qty <= 0) return cart.filter((line) => line.productId !== productId)
  return cart.map((line) => (line.productId === productId ? { ...line, qty } : line))
}

export function cartTotal(cart: Cart): Centavos {
  return cart.reduce((total, line) => total + line.price * line.qty, 0)
}

export function changeDue(total: Centavos, received: Centavos): Centavos | null {
  return received >= total ? received - total : null
}
