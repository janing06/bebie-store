// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test } from 'vitest'
import { Router } from 'wouter'
import { memoryLocation } from 'wouter/memory-location'
import { AppRoutes } from '../App'
import { addProduct } from '../data/products'
import { checkout } from '../data/sales'
import { addCustomer } from '../data/utang'
import { db } from '../db'
import { addToCart } from '../domain/cart'
import { sampleProduct } from '../test/helpers'

beforeEach(async () => {
  await Promise.all(db.tables.map((table) => table.clear()))
})
afterEach(cleanup)

test('records a partial payment from the customer page', async () => {
  const rice = await addProduct(db, sampleProduct({ name: 'Rice 1kg', price: 45000 }))
  const nena = await addCustomer(db, 'Aling Nena', '')
  await checkout(db, { cart: addToCart([], rice, 1), payment: 'utang', customerId: nena.id })
  const user = userEvent.setup()
  render(
    <Router hook={memoryLocation({ path: '/utang' }).hook}>
      <AppRoutes />
    </Router>,
  )

  await user.click(await screen.findByRole('link', { name: /Aling Nena/ }))
  await user.click(await screen.findByRole('button', { name: 'Record payment' }))
  const sheet = screen.getByRole('dialog', { name: 'Record payment' })
  await user.type(within(sheet).getByLabelText(/Amount/), '200')
  await user.click(within(sheet).getByRole('button', { name: 'Save payment' }))

  expect(await screen.findByText('₱250')).toBeInTheDocument()
})
