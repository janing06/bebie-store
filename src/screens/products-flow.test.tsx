// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
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

test('keeps the restocked cost when saving the form afterwards', async () => {
  const mami = await addProduct(db, sampleProduct({ price: 900, cost: 800 }))
  const user = userEvent.setup()
  renderAt(`/products/${mami.id}`)

  await user.click(await screen.findByRole('button', { name: /Restock/ }))
  const sheet = await screen.findByRole('dialog')
  await user.type(within(sheet).getByLabelText(/New cost/), '8.25')
  await user.click(within(sheet).getByRole('button', { name: 'Add stock' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

  await user.click(screen.getByRole('button', { name: 'Save changes' }))
  await screen.findByRole('heading', { name: 'Products' })
  expect((await db.products.get(mami.id))?.cost).toBe(825)
})

test('turns a stopped product on again from its page', async () => {
  const mami = await addProduct(db, sampleProduct())
  await db.products.update(mami.id, { active: false })
  const user = userEvent.setup()
  renderAt(`/products/${mami.id}`)

  await user.click(await screen.findByRole('button', { name: 'Turn on again' }))
  await waitFor(async () => expect((await db.products.get(mami.id))?.active).toBe(true))
})

test('turns a stopped product on from the Stopped list', async () => {
  const mami = await addProduct(db, sampleProduct({ name: 'Old Item' }))
  await db.products.update(mami.id, { active: false })
  const user = userEvent.setup()
  renderAt('/products')

  await user.click(await screen.findByRole('button', { name: /Stopped/ }))
  await user.click(await screen.findByRole('button', { name: 'Turn on' }))
  await waitFor(() => expect(screen.queryByText('Old Item')).not.toBeInTheDocument())
  expect((await db.products.get(mami.id))?.active).toBe(true)
})

test('restocks by a typed count and blocks an empty one', async () => {
  const mami = await addProduct(db, sampleProduct({ startingStock: 2 }))
  const user = userEvent.setup()
  renderAt(`/products/${mami.id}`)

  await user.click(await screen.findByRole('button', { name: /Restock/ }))
  const sheet = await screen.findByRole('dialog')
  const count = within(sheet).getByLabelText('Count')
  await user.clear(count)
  expect(within(sheet).getByRole('button', { name: 'Add stock' })).toBeDisabled()
  await user.type(count, '48')
  await user.click(within(sheet).getByRole('button', { name: 'Add stock' }))

  await waitFor(async () => expect((await db.products.get(mami.id))?.stock).toBe(50))
})

test('field help opens and closes per field without stealing focus', async () => {
  const user = userEvent.setup()
  renderAt('/products/new')

  const costHelp = await screen.findByRole('button', { name: 'Help: Cost' })
  expect(costHelp).toHaveAttribute('aria-expanded', 'false')
  expect(screen.queryByText(/Pila ang palit nimo/)).not.toBeInTheDocument()

  await user.click(costHelp)
  expect(costHelp).toHaveAttribute('aria-expanded', 'true')
  expect(screen.getByText(/Pila ang palit nimo/)).toBeInTheDocument()
  expect(screen.getByText(/What you paid for one piece/)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Help: Price' })).toHaveAttribute(
    'aria-expanded',
    'false',
  )
  expect(screen.queryByText(/Presyo kada piraso/)).not.toBeInTheDocument()

  await user.click(costHelp)
  expect(costHelp).toHaveAttribute('aria-expanded', 'false')
  expect(screen.queryByText(/Pila ang palit nimo/)).not.toBeInTheDocument()
})

test('typing in Name still works after opening help', async () => {
  const user = userEvent.setup()
  renderAt('/products/new')

  const name = await screen.findByLabelText(/Name/)
  await user.click(screen.getByRole('button', { name: 'Help: Name' }))
  expect(name).not.toHaveFocus()
  await user.type(name, 'Coke')
  expect(name).toHaveValue('Coke')
  expect(name).toHaveFocus()
})

test('favorites help does not toggle the favorites switch', async () => {
  const user = userEvent.setup()
  renderAt('/products/new')

  const favorite = await screen.findByLabelText('Show in favorites')
  await user.click(screen.getByRole('button', { name: 'Help: Show in favorites' }))
  expect(favorite).not.toBeChecked()
  expect(screen.getByText(/Ipakita sa Sell screen/)).toBeInTheDocument()
  await user.click(screen.getByText('Show in favorites'))
  expect(favorite).toBeChecked()
})
