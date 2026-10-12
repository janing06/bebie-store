// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test } from 'vitest'
import { Router } from 'wouter'
import { memoryLocation } from 'wouter/memory-location'
import { AppRoutes } from '../App'
import { addProduct } from '../data/products'
import { addCustomer } from '../data/utang'
import { db } from '../db'
import { sampleProduct } from '../test/helpers'

beforeEach(async () => {
  await Promise.all(db.tables.map((table) => table.clear()))
})
afterEach(cleanup)

function renderApp() {
  render(
    <Router hook={memoryLocation({ path: '/' }).hook}>
      <AppRoutes />
    </Router>,
  )
}

test('sells a favorite for cash and shows the change', async () => {
  const coke = await addProduct(db, sampleProduct({ favorite: true, startingStock: 10 }))
  const user = userEvent.setup()
  renderApp()

  await user.click(await screen.findByRole('button', { name: /Coke 1\.5L/ }))
  await user.click(screen.getByRole('link', { name: /1 item/ }))
  await user.click(screen.getByRole('button', { name: '₱100' }))
  await user.click(screen.getByRole('button', { name: /Done/ }))

  expect(await screen.findByText('Sale saved')).toBeInTheDocument()
  expect(screen.getByText('₱25')).toBeInTheDocument()
  expect((await db.products.get(coke.id))?.stock).toBe(9)
})

test('quick add asks for a cost, then adds the product to the cart', async () => {
  const user = userEvent.setup()
  renderApp()

  await user.click(await screen.findByRole('button', { name: 'Quick add' }))
  await user.type(screen.getByLabelText(/^Name/), 'Ice')
  await user.type(screen.getByLabelText(/^Price/), '5')
  await user.click(screen.getByRole('button', { name: 'Add to cart' }))
  expect(await screen.findByText('Cost is required')).toBeInTheDocument()
  expect(await db.products.count()).toBe(0)

  await user.type(screen.getByLabelText(/^Cost/), '3')
  await user.click(screen.getByRole('button', { name: 'Add to cart' }))
  expect(await screen.findByRole('link', { name: /1 item/ })).toBeInTheDocument()
  expect(await db.products.toArray()).toMatchObject([{ name: 'Ice', price: 500, cost: 300 }])
})

test('sells a pack on utang to a customer', async () => {
  const marlboro = await addProduct(
    db,
    sampleProduct({
      name: 'Marlboro Red',
      price: 900,
      cost: 825,
      packSize: 20,
      favorite: true,
      startingStock: 46,
    }),
  )
  const nena = await addCustomer(db, 'Aling Nena', 'near the chapel')
  const user = userEvent.setup()
  renderApp()

  await user.click(await screen.findByRole('button', { name: /Marlboro Red/ }))
  const sheet = screen.getByRole('dialog', { name: 'Marlboro Red' })
  await user.click(within(sheet).getByRole('button', { name: /Pack \(20\)/ }))
  await user.click(within(sheet).getByRole('button', { name: 'Add ₱180' }))
  await user.click(screen.getByRole('link', { name: /1 item/ }))
  await user.click(screen.getByRole('button', { name: 'Utang' }))
  await user.click(await screen.findByRole('button', { name: /Aling Nena/ }))

  expect(await screen.findByText('Sale saved')).toBeInTheDocument()
  expect((await db.products.get(marlboro.id))?.stock).toBe(26)
  const [sale] = await db.sales.toArray()
  expect(sale).toMatchObject({ payment: 'utang', customerId: nena.id, total: 18000 })
})

test('the cart bar counts lines, not pieces', async () => {
  await addProduct(db, sampleProduct({ favorite: true, startingStock: 10 }))
  await addProduct(
    db,
    sampleProduct({
      name: 'Marlboro Red',
      price: 900,
      packSize: 20,
      favorite: true,
      startingStock: 46,
    }),
  )
  const user = userEvent.setup()
  renderApp()

  await user.click(await screen.findByRole('button', { name: /Coke 1\.5L/ }))
  await user.click(screen.getByRole('button', { name: /Marlboro Red/ }))
  const sheet = screen.getByRole('dialog', { name: 'Marlboro Red' })
  await user.click(within(sheet).getByRole('button', { name: /Pack \(20\)/ }))
  await user.click(within(sheet).getByRole('button', { name: 'Add ₱180' }))

  expect(screen.getByRole('link', { name: /2 items/ })).toBeInTheDocument()
})

test('double-tapping Done saves only one sale', async () => {
  await addProduct(db, sampleProduct({ favorite: true }))
  const user = userEvent.setup()
  renderApp()

  await user.click(await screen.findByRole('button', { name: /Coke 1\.5L/ }))
  await user.click(screen.getByRole('link', { name: /1 item/ }))
  await user.click(screen.getByRole('button', { name: 'Exact' }))
  await user.dblClick(screen.getByRole('button', { name: /Done/ }))

  expect(await screen.findByText('Sale saved')).toBeInTheDocument()
  expect(await db.sales.count()).toBe(1)
})

test('a failed utang checkout closes the picker and shows the error', async () => {
  const coke = await addProduct(db, sampleProduct({ favorite: true }))
  await addCustomer(db, 'Aling Nena', '')
  const user = userEvent.setup()
  renderApp()

  await user.click(await screen.findByRole('button', { name: /Coke 1\.5L/ }))
  await db.products.delete(coke.id)
  await user.click(screen.getByRole('link', { name: /1 item/ }))
  await user.click(screen.getByRole('button', { name: 'Utang' }))
  await user.click(await screen.findByRole('button', { name: /Aling Nena/ }))

  expect(await screen.findByText(/Not saved\. Please try again\./)).toBeInTheDocument()
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(await db.sales.count()).toBe(0)
})

test('double-tapping New customer creates only one customer', async () => {
  await addProduct(db, sampleProduct({ favorite: true }))
  const user = userEvent.setup()
  renderApp()

  await user.click(await screen.findByRole('button', { name: /Coke 1\.5L/ }))
  await user.click(screen.getByRole('link', { name: /1 item/ }))
  await user.click(screen.getByRole('button', { name: 'Utang' }))
  await user.type(await screen.findByPlaceholderText(/Name/), 'Kuya Boy')
  await user.dblClick(screen.getByRole('button', { name: /New customer/ }))

  expect(await screen.findByText('Sale saved')).toBeInTheDocument()
  expect(await db.customers.count()).toBe(1)
  expect(await db.sales.count()).toBe(1)
})

test('clearing the cart empties it, returns to Sell and writes nothing', async () => {
  const coke = await addProduct(db, sampleProduct({ favorite: true, startingStock: 10 }))
  const user = userEvent.setup()
  renderApp()

  await user.click(await screen.findByRole('button', { name: /Coke 1\.5L/ }))
  await user.click(screen.getByRole('link', { name: /1 item/ }))
  await user.click(screen.getByRole('button', { name: 'Clear cart' }))
  const sheet = screen.getByRole('dialog', { name: 'Clear cart?' })
  expect(within(sheet).getByText('1 item will be removed.')).toBeInTheDocument()
  await user.click(within(sheet).getByRole('button', { name: 'Clear cart' }))

  expect(await screen.findByRole('button', { name: /Coke 1\.5L/ })).toBeInTheDocument()
  expect(screen.queryByRole('link', { name: /item/ })).not.toBeInTheDocument()
  expect(await db.sales.count()).toBe(0)
  expect((await db.products.get(coke.id))?.stock).toBe(10)
})

test('cancelling Clear cart keeps the cart', async () => {
  await addProduct(db, sampleProduct({ favorite: true, startingStock: 10 }))
  const user = userEvent.setup()
  renderApp()

  await user.click(await screen.findByRole('button', { name: /Coke 1\.5L/ }))
  await user.click(screen.getByRole('link', { name: /1 item/ }))
  await user.click(screen.getByRole('button', { name: 'Clear cart' }))
  await user.click(screen.getByRole('button', { name: 'Cancel' }))

  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Remove Coke 1.5L' })).toBeInTheDocument()
})

test('a qty-1 line offers Remove and a qty-2 line offers Less', async () => {
  await addProduct(db, sampleProduct({ favorite: true, startingStock: 10 }))
  const user = userEvent.setup()
  renderApp()

  await user.click(await screen.findByRole('button', { name: /Coke 1\.5L/ }))
  await user.click(screen.getByRole('button', { name: /Coke 1\.5L/ }))
  await user.click(screen.getByRole('link', { name: /1 item/ }))
  expect(screen.getByRole('button', { name: 'Less Coke 1.5L' })).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: 'Less Coke 1.5L' }))
  await user.click(screen.getByRole('button', { name: 'Remove Coke 1.5L' }))

  expect(screen.getByText('The cart is empty.')).toBeInTheDocument()
})
