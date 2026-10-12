// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test } from 'vitest'
import { Router } from 'wouter'
import { memoryLocation } from 'wouter/memory-location'
import { AppRoutes } from '../App'
import { addProduct } from '../data/products'
import { db } from '../db'
import { sampleProduct } from '../test/helpers'

beforeEach(async () => {
  await Promise.all(db.tables.map((table) => table.clear()))
})
afterEach(cleanup)

function renderAt(path: string) {
  render(
    <Router hook={memoryLocation({ path }).hook}>
      <AppRoutes />
    </Router>,
  )
}

test('adds one product from the form', async () => {
  const user = userEvent.setup()
  renderAt('/products/new')

  await user.type(await screen.findByLabelText(/Name/), 'Lucky Me Beef Mami')
  await user.type(screen.getByLabelText(/^Price/), '16')
  await user.type(screen.getByLabelText(/Starting stock/), '24')
  await user.click(screen.getByRole('button', { name: 'Save product' }))

  expect(await screen.findByText('Lucky Me Beef Mami')).toBeInTheDocument()
  const [product] = await db.products.toArray()
  expect(product).toMatchObject({ name: 'Lucky Me Beef Mami', price: 1600, stock: 24 })
})

test('warns about a similar existing product while typing', async () => {
  await addProduct(db, sampleProduct({ name: 'Lucky Me Beef Mami' }))
  const user = userEvent.setup()
  renderAt('/products/new')

  await user.type(await screen.findByLabelText(/Name/), 'lucky beef')
  expect(await screen.findByText(/Already in your products/)).toBeInTheDocument()
})

test('warns when the price is below cost but still saves', async () => {
  const coke = await addProduct(db, sampleProduct({ price: 7500, cost: 6600 }))
  const user = userEvent.setup()
  renderAt(`/products/${coke.id}`)

  const price = await screen.findByLabelText(/^Price/)
  await user.clear(price)
  await user.type(price, '60')
  expect(screen.getByText(/below cost/)).toBeInTheDocument()
  expect(screen.getByText('was ₱75')).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: 'Save changes' }))
  await screen.findByRole('heading', { name: 'Products' })
  expect((await db.products.get(coke.id))?.price).toBe(6000)
})
