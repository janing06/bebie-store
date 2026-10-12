// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test } from 'vitest'
import { Router } from 'wouter'
import { memoryLocation } from 'wouter/memory-location'
import { AppRoutes } from '../App'
import { addProduct } from '../data/products'
import { checkout } from '../data/sales'
import { db } from '../db'
import { addToCart } from '../domain/cart'
import { sampleProduct } from '../test/helpers'

beforeEach(async () => {
  await Promise.all(db.tables.map((table) => table.clear()))
})
afterEach(cleanup)

function renderMore() {
  render(
    <Router hook={memoryLocation({ path: '/more' }).hook}>
      <AppRoutes />
    </Router>,
  )
}

test('reminds Bebie to back up when there has never been a backup', async () => {
  renderMore()
  expect(await screen.findByText(/No backup yet/)).toBeInTheDocument()
  expect(screen.getByText("Bebie's Store · made with ❤️ for Bebie")).toBeInTheDocument()
})

test("voids one of today's sales and returns the stock", async () => {
  const coke = await addProduct(db, sampleProduct({ startingStock: 10 }))
  await checkout(db, { cart: addToCart([], coke, 2), payment: 'cash', cashReceived: 15000 })
  const user = userEvent.setup()
  renderMore()

  await user.click(await screen.findByRole('button', { name: 'Void' }))
  await user.click(screen.getByRole('button', { name: 'Void sale' }))

  expect(await screen.findByText('voided')).toBeInTheDocument()
  expect((await db.products.get(coke.id))?.stock).toBe(10)
})
