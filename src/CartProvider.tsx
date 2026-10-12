import { useState, type ReactNode } from 'react'
import { CartContext } from './cart-context'
import type { Cart } from './domain/cart'

export function CartProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<Cart>([])
  return <CartContext value={{ cart, setCart }}>{children}</CartContext>
}
