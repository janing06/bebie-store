// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test } from 'vitest'
import { AppRoutes } from './App'
import { db } from './db'

beforeEach(async () => {
  await Promise.all(db.tables.map((table) => table.clear()))
  window.history.replaceState(null, '', '/')
})
afterEach(cleanup)

async function openTab(name: string) {
  await userEvent.click(within(screen.getByRole('navigation')).getByRole('link', { name }))
  expect(await screen.findByRole('heading', { name, level: 1 })).toBeInTheDocument()
}

test('Back from any tab returns to Sell, however many tabs were visited', async () => {
  render(<AppRoutes />)
  await openTab('Products')
  const sellPlusOneTab = window.history.length
  await openTab('Utang')
  await openTab('Reports')

  expect(window.history.length).toBe(sellPlusOneTab)
  window.history.back()
  await waitFor(() => expect(window.location.pathname).toBe('/'))
})

test('tapping Sell goes back to the Sell entry instead of stacking a new one', async () => {
  render(<AppRoutes />)
  await openTab('Products')
  const sellPlusOneTab = window.history.length
  await userEvent.click(within(screen.getByRole('navigation')).getByRole('link', { name: 'Sell' }))
  await waitFor(() => expect(window.location.pathname).toBe('/'))
  await openTab('More')

  expect(window.history.length).toBe(sellPlusOneTab)
})
