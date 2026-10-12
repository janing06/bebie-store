import { createContext, useContext } from 'react'
import type { Cart } from './domain/cart'

export interface CartState {
  cart: Cart
  setCart: (cart: Cart) => void
}

export const CartContext = createContext<CartState | null>(null)

export function useCart(): CartState {
  const state = useContext(CartContext)
  if (!state) throw new Error('useCart must be used inside CartProvider')
  return state
}
