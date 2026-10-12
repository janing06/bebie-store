// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test } from 'vitest'
import { Router } from 'wouter'
import { memoryLocation } from 'wouter/memory-location'
import { AppRoutes } from '../App'
import { saveFavoriteOrder } from '../data/favorites'
import { loadAllProductsSort } from '../data/preferences'
import { addProduct } from '../data/products'
import { checkout } from '../data/sales'
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

function tileNames() {
  return screen
    .getAllByRole('button', { name: /₱/ })
    .map((tile) => tile.textContent?.replace(/₱.*/, ''))
}

async function seedFavorites() {
  const coke = await addProduct(db, sampleProduct({ favorite: true }))
  const ice = await addProduct(db, sampleProduct({ name: 'Ice', favorite: true }))
  return { coke, ice }
}

test('Arrange shows Done and hides Quick add', async () => {
  await seedFavorites()
  const user = userEvent.setup()
  renderApp()

  await user.click(await screen.findByRole('button', { name: 'Arrange' }))

  expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument()
  expect(screen.getByText('Drag to reorder')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Quick add' })).not.toBeInTheDocument()
  expect(screen.getByPlaceholderText('Search product…')).toBeDisabled()
})

test('tapping a tile while arranging does not add to the cart', async () => {
  await seedFavorites()
  const user = userEvent.setup()
  renderApp()

  await user.click(await screen.findByRole('button', { name: 'Arrange' }))
  await user.click(screen.getByRole('button', { name: /Coke 1\.5L/ }))

  expect(screen.queryByRole('link', { name: /item/ })).not.toBeInTheDocument()
})

test('Done returns to normal selling', async () => {
  await seedFavorites()
  const user = userEvent.setup()
  renderApp()

  await user.click(await screen.findByRole('button', { name: 'Arrange' }))
  await user.click(screen.getByRole('button', { name: 'Done' }))
  await user.click(screen.getByRole('button', { name: /Coke 1\.5L/ }))

  expect(await screen.findByRole('link', { name: /1 item/ })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Quick add' })).toBeInTheDocument()
})

test('hides Arrange with fewer than two favorites', async () => {
  await addProduct(db, sampleProduct({ favorite: true }))
  renderApp()

  expect(await screen.findByRole('button', { name: /Coke 1\.5L/ })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Arrange' })).not.toBeInTheDocument()
})

test('renders favorites in the saved order', async () => {
  const { coke, ice } = await seedFavorites()
  await saveFavoriteOrder(db, [ice.id, coke.id])
  renderApp()

  await screen.findByRole('button', { name: /Coke 1\.5L/ })
  await waitFor(() => expect(tileNames()).toEqual(['Ice', 'Coke 1.5L']))
})

async function seedMixed() {
  await addProduct(db, sampleProduct({ favorite: true }))
  await addProduct(db, sampleProduct({ name: 'Ice', favorite: true }))
  await addProduct(db, sampleProduct({ name: 'Yelo', favorite: false }))
}

test('lists non-favorites under ALL PRODUCTS, not favorites', async () => {
  await seedMixed()
  renderApp()

  expect(await screen.findByText('ALL PRODUCTS')).toBeInTheDocument()
  expect(screen.getAllByRole('button', { name: /Yelo/ })).toHaveLength(1)
  expect(screen.getAllByRole('button', { name: /Coke 1\.5L/ })).toHaveLength(1)
})

test('ALL PRODUCTS rows show stock, with pack size for pack items', async () => {
  await addProduct(db, sampleProduct({ name: 'Yelo', startingStock: 24 }))
  await addProduct(
    db,
    sampleProduct({ name: 'Marlboro Red', price: 900, packSize: 20, startingStock: 46 }),
  )
  renderApp()

  expect(await screen.findByRole('button', { name: /Yelo.*Stock: 24/ })).toBeInTheDocument()
  expect(
    screen.getByRole('button', { name: /Marlboro Red.*Stock: 46 pcs · Pack of 20/ }),
  ).toBeInTheDocument()
})

test('tapping an ALL PRODUCTS row adds it to the cart', async () => {
  await seedMixed()
  const user = userEvent.setup()
  renderApp()

  await user.click(await screen.findByRole('button', { name: /Yelo/ }))

  expect(await screen.findByRole('link', { name: /1 item/ })).toBeInTheDocument()
})

test('hides ALL PRODUCTS while arranging', async () => {
  await seedMixed()
  const user = userEvent.setup()
  renderApp()

  await user.click(await screen.findByRole('button', { name: 'Arrange' }))

  expect(screen.queryByText('ALL PRODUCTS')).not.toBeInTheDocument()
})

async function sellOne(productId: string, name: string, qty: number) {
  await checkout(db, {
    cart: [{ productId, name, price: 7500, cost: 6200, qty }],
    payment: 'cash',
    cashReceived: 100000,
  })
}

async function seedSortable() {
  await addProduct(db, sampleProduct({ name: 'Apple' }))
  const zebra = await addProduct(db, sampleProduct({ name: 'Zebra' }))
  await sellOne(zebra.id, 'Zebra', 12)
}

function rowNames() {
  return screen
    .getAllByRole('button', { name: /Stock:/ })
    .map((row) => row.textContent?.replace(/Stock:.*/, ''))
}

test('ALL PRODUCTS defaults to A-Z without sold counts', async () => {
  await seedSortable()
  renderApp()

  await screen.findByRole('button', { name: /Zebra/ })
  expect(rowNames()).toEqual(['Apple', 'Zebra'])
  expect(screen.getByRole('button', { name: 'A–Z' })).toHaveClass('bg-brand')
  expect(screen.queryByText(/sold \(30 days\)/)).not.toBeInTheDocument()
})

test('Best sellers moves top sellers first and shows sold count', async () => {
  await seedSortable()
  const user = userEvent.setup()
  renderApp()

  await user.click(await screen.findByRole('button', { name: 'Best sellers' }))

  await waitFor(() => expect(rowNames()).toEqual(['Zebra', 'Apple']))
  expect(screen.getByText(/12 sold \(30 days\)/)).toBeInTheDocument()
})

test('the sort choice is saved and restored', async () => {
  await seedSortable()
  const user = userEvent.setup()
  renderApp()
  await user.click(await screen.findByRole('button', { name: 'Best sellers' }))
  await waitFor(() => expect(rowNames()).toEqual(['Zebra', 'Apple']))
  expect(await loadAllProductsSort(db)).toBe('best')

  cleanup()
  renderApp()

  await screen.findByRole('button', { name: /Zebra/ })
  await waitFor(() => expect(rowNames()).toEqual(['Zebra', 'Apple']))
})
