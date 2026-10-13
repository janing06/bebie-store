// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterAll, afterEach, beforeAll, beforeEach, expect, test, vi } from 'vitest'
import { Router } from 'wouter'
import { memoryLocation } from 'wouter/memory-location'
import { AppRoutes } from '../App'
import { addProduct } from '../data/products'
import { db } from '../db'
import { sampleProduct } from '../test/helpers'

const BAR_WIDTH = 300 // jsdom has no layout, so give the cart bar a width

beforeAll(() => {
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(BAR_WIDTH)
})
afterAll(() => vi.restoreAllMocks())
beforeEach(async () => {
  await Promise.all(db.tables.map((table) => table.clear()))
})
afterEach(cleanup)

async function sellWithTwoItems() {
  await addProduct(db, sampleProduct({ name: 'Coke 1.5L', price: 7500, favorite: true }))
  await addProduct(db, sampleProduct({ name: 'Rice 1kg', price: 4500, favorite: true }))
  const user = userEvent.setup()
  render(
    <Router hook={memoryLocation({ path: '/' }).hook}>
      <AppRoutes />
    </Router>,
  )
  await user.click(await screen.findByRole('button', { name: /Coke 1\.5L/ }))
  await user.click(screen.getByRole('button', { name: /Rice 1kg/ }))
  return user
}

const cartBar = () => screen.getByRole('link', { name: /2 items/ })

function swipe(distance: number) {
  const bar = cartBar()
  fireEvent.pointerDown(bar, { clientX: 250, pointerId: 1 })
  fireEvent.pointerMove(bar, { clientX: 250 - distance / 2, pointerId: 1 })
  fireEvent.pointerMove(bar, { clientX: 250 - distance, pointerId: 1 })
  fireEvent.pointerUp(bar, { clientX: 250 - distance, pointerId: 1 })
}

test('swiping the cart bar past a quarter clears the cart, and Undo brings it back', async () => {
  const user = await sellWithTwoItems()

  swipe(BAR_WIDTH * 0.3)

  expect(await screen.findByText('Cleared 2 items · ₱120')).toBeInTheDocument()
  expect(screen.queryByRole('link', { name: /2 items/ })).not.toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: 'Undo' }))
  expect(cartBar()).toHaveTextContent('₱120')
})

test('a short swipe shows the trash button, which clears the cart', async () => {
  const user = await sellWithTwoItems()

  swipe(60)
  await user.click(screen.getByRole('button', { name: 'Clear cart' }))

  expect(await screen.findByText('Cleared 2 items · ₱120')).toBeInTheDocument()
})

test('vibrates once when the swipe reaches the clear point', async () => {
  const vibrate = vi.fn()
  Object.defineProperty(navigator, 'vibrate', { value: vibrate, configurable: true })
  await sellWithTwoItems()

  swipe(BAR_WIDTH * 0.8)

  expect(vibrate).toHaveBeenCalledTimes(1)
  Reflect.deleteProperty(navigator, 'vibrate')
})

test('a tap without swiping still opens the cart', async () => {
  const user = await sellWithTwoItems()

  await user.click(cartBar())

  expect(await screen.findByRole('heading', { name: 'Cart' })).toBeInTheDocument()
})

test('a tap opens the cart after a swipe that was slid back', async () => {
  const user = await sellWithTwoItems()

  swipe(60)
  swipe(-60) // phones send no click after a drag

  await user.click(cartBar())
  expect(await screen.findByRole('heading', { name: 'Cart' })).toBeInTheDocument()
})

test('Undo goes away after 5 seconds', async () => {
  await sellWithTwoItems()
  vi.useFakeTimers()

  swipe(BAR_WIDTH * 0.6)
  await act(() => vi.advanceTimersByTimeAsync(500))
  expect(screen.getByRole('button', { name: 'Undo' })).toBeInTheDocument()
  await act(() => vi.advanceTimersByTimeAsync(5000))

  expect(screen.queryByRole('button', { name: 'Undo' })).not.toBeInTheDocument()
  vi.useRealTimers()
})

test('the swipe hint shows until she has swiped 3 times', async () => {
  await sellWithTwoItems()
  expect(await screen.findByText('← Swipe left to clear')).toBeInTheDocument()

  for (let i = 0; i < 3; i++) {
    swipe(60) // rests open
    swipe(-60) // slides closed
  }
  expect(cartBar()).toBeInTheDocument()

  await vi.waitFor(() => expect(screen.queryByText('← Swipe left to clear')).toBeNull())
})
