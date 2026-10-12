// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test } from 'vitest'
import { Router } from 'wouter'
import { memoryLocation } from 'wouter/memory-location'
import { AppRoutes } from '../App'
import { exportBackup } from '../data/backup'
import { addProduct } from '../data/products'
import { checkout } from '../data/sales'
import { db } from '../db'
import { addToCart } from '../domain/cart'
import { freshDb, sampleProduct } from '../test/helpers'

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

function jsonFile(content: string) {
  return new File([content], 'backup.json', { type: 'application/json' })
}

test('shows the parse error and keeps the data when the restore file is not a backup', async () => {
  await addProduct(db, sampleProduct())
  const user = userEvent.setup()
  renderMore()

  await user.upload(await screen.findByLabelText('Restore from backup'), jsonFile('not json'))

  expect(await screen.findByText('This is not a valid backup file.')).toBeInTheDocument()
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(await db.products.count()).toBe(1)
})

test('restores a valid backup after confirming', async () => {
  const other = freshDb()
  await addProduct(other, sampleProduct({ name: 'Pepsi 1L' }))
  const backup = await exportBackup(other)
  await addProduct(db, sampleProduct({ name: 'Coke 1.5L' }))
  const user = userEvent.setup()
  renderMore()

  await user.upload(
    await screen.findByLabelText('Restore from backup'),
    jsonFile(JSON.stringify(backup)),
  )
  await user.click(await screen.findByRole('button', { name: 'Replace and restore' }))

  expect(await screen.findByText('Backup restored.')).toBeInTheDocument()
  expect((await db.products.toArray()).map((product) => product.name)).toEqual(['Pepsi 1L'])
})
