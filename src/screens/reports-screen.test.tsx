// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
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

test("shows today's sales, profit and a cheer for Bebie", async () => {
  const coke = await addProduct(db, sampleProduct({ price: 7500, cost: 6200 }))
  await checkout(db, { cart: addToCart([], coke, 2), payment: 'cash', cashReceived: 15000 })
  render(
    <Router hook={memoryLocation({ path: '/reports' }).hook}>
      <AppRoutes />
    </Router>,
  )

  expect(
    await screen.findByText('Nice work today, Bebie! 🎉 1 customer served.'),
  ).toBeInTheDocument()
  expect(screen.getAllByText('₱150').length).toBeGreaterThan(0)
  expect(screen.getByText('₱26')).toBeInTheDocument()
})

test('says "1 sale" for a single sale', async () => {
  const coke = await addProduct(db, sampleProduct())
  await checkout(db, { cart: addToCart([], coke, 1), payment: 'cash', cashReceived: 10000 })
  render(
    <Router hook={memoryLocation({ path: '/reports' }).hook}>
      <AppRoutes />
    </Router>,
  )

  expect(await screen.findByText('1 sale')).toBeInTheDocument()
})

test('says "1 pc" for a single piece sold', async () => {
  const coke = await addProduct(db, sampleProduct({ price: 7500 }))
  await checkout(db, { cart: addToCart([], coke, 1), payment: 'cash', cashReceived: 10000 })
  render(
    <Router hook={memoryLocation({ path: '/reports' }).hook}>
      <AppRoutes />
    </Router>,
  )

  expect(await screen.findByText('1 pc · ₱75')).toBeInTheDocument()
})
