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

test('field help opens as a sheet and closes with the button', async () => {
  const user = userEvent.setup()
  renderAt('/products/new')

  const costHelp = await screen.findByRole('button', { name: 'Help: Cost' })
  expect(costHelp).toHaveAttribute('aria-expanded', 'false')
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

  await user.click(costHelp)
  const dialog = screen.getByRole('dialog', { name: 'Cost' })
  expect(costHelp).toHaveAttribute('aria-expanded', 'true')
  expect(within(dialog).getByText(/Pila ang palit nimo/)).toBeInTheDocument()
  expect(within(dialog).getByText(/What you paid for one piece/)).toBeInTheDocument()
  expect(document.body.style.overflow).toBe('hidden')

  await user.click(within(dialog).getByRole('button', { name: 'Sige, gets nako' }))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(document.body.style.overflow).toBe('')
})

test('field help closes on an overlay tap or Escape', async () => {
  const user = userEvent.setup()
  renderAt('/products/new')

  const priceHelp = await screen.findByRole('button', { name: 'Help: Price' })
  await user.click(priceHelp)
  await user.click(screen.getByRole('dialog', { name: 'Price' }).parentElement!)
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

  await user.click(priceHelp)
  await user.keyboard('{Escape}')
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})

test('typing in Name still works after opening and closing help', async () => {
  const user = userEvent.setup()
  renderAt('/products/new')

  const name = await screen.findByLabelText(/Name/)
  await user.type(name, 'Co')
  await user.click(screen.getByRole('button', { name: 'Help: Name' }))
  await user.click(screen.getByRole('button', { name: 'Sige, gets nako' }))
  await user.type(name, 'ke')
  expect(name).toHaveValue('Coke')
})

test('favorites help does not toggle the favorites switch', async () => {
  const user = userEvent.setup()
  renderAt('/products/new')

  const favorite = await screen.findByLabelText('Show in favorites')
  await user.click(screen.getByRole('button', { name: 'Help: Show in favorites' }))
  expect(favorite).not.toBeChecked()
  expect(screen.getByRole('dialog', { name: 'Show in favorites' })).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Sige, gets nako' }))
  await user.click(screen.getByText('Show in favorites'))
  expect(favorite).toBeChecked()
})

test('help inside the Restock sheet leaves the Restock sheet open', async () => {
  const coke = await addProduct(db, sampleProduct())
  const user = userEvent.setup()
  renderAt(`/products/${coke.id}`)

  await user.click(await screen.findByRole('button', { name: /Restock/ }))
  await user.click(screen.getByRole('button', { name: /^Help: New cost/ }))
  expect(screen.getAllByRole('dialog')).toHaveLength(2)
  expect(document.body.style.overflow).toBe('hidden')

  await user.click(screen.getByRole('button', { name: 'Sige, gets nako' }))
  expect(screen.getAllByRole('dialog')).toHaveLength(1)
  expect(screen.getByRole('dialog', { name: /Restock/ })).toBeInTheDocument()
  expect(document.body.style.overflow).toBe('hidden')

  await user.keyboard('{Escape}')
  await user.click(screen.getByRole('button', { name: /^Help: New cost/ }))
  await user.keyboard('{Escape}')
  expect(screen.getAllByRole('dialog')).toHaveLength(1)
})

test('No cost lists only active products without a cost', async () => {
  await addProduct(db, sampleProduct({ name: 'Costed Item', cost: 500 }))
  await addProduct(db, sampleProduct({ name: 'Bare Item', cost: null }))
  const user = userEvent.setup()
  renderAt('/products')

  await user.click(await screen.findByRole('button', { name: 'No cost 1' }))
  expect(screen.getByText('Bare Item')).toBeInTheDocument()
  expect(screen.getByText(/no cost yet/)).toBeInTheDocument()
  expect(screen.queryByText('Costed Item')).not.toBeInTheDocument()
})

test('adding a cost empties the No cost list', async () => {
  const bare = await addProduct(db, sampleProduct({ name: 'Bare Item', cost: null }))
  const user = userEvent.setup()
  renderAt('/products')

  await user.click(await screen.findByRole('button', { name: 'No cost 1' }))
  await user.click(screen.getByText('Bare Item'))
  await user.type(await screen.findByLabelText(/^Cost/), '5')
  await user.click(screen.getByRole('button', { name: 'Save changes' }))

  expect(await screen.findByRole('button', { name: 'No cost 0' })).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'No cost 0' }))
  expect(screen.getByText('All products have a cost.')).toBeInTheDocument()
  expect((await db.products.get(bare.id))?.cost).toBe(500)
})
