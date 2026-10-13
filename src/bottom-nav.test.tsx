// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
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

describe('with CloseWatcher (Chrome on Android)', () => {
  const watchers: { onclose: (() => void) | null; destroyed: boolean }[] = []

  beforeEach(() => {
    watchers.length = 0
    vi.stubGlobal(
      'CloseWatcher',
      class {
        onclose: (() => void) | null = null
        destroyed = false
        constructor() {
          watchers.push(this)
        }
        destroy() {
          this.destroyed = true
        }
      },
    )
  })
  afterEach(() => vi.unstubAllGlobals())

  test('switches tabs without history entries, so Back plays no page animation', async () => {
    render(<AppRoutes />)
    const before = window.history.length
    await openTab('Products')
    await openTab('Utang')

    expect(window.history.length).toBe(before)
  })

  test('Back on a tab returns to Sell', async () => {
    render(<AppRoutes />)
    await openTab('Reports')

    watchers.find((watcher) => !watcher.destroyed)?.onclose?.()

    expect(await screen.findByRole('heading', { name: "Bebie's Store", level: 1 })).toBeVisible()
    expect(watchers.every((watcher) => watcher.destroyed)).toBe(true)
  })
})
