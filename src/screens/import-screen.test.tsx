// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test } from 'vitest'
import { Router } from 'wouter'
import { memoryLocation } from 'wouter/memory-location'
import { AppRoutes } from '../App'
import { db } from '../db'

beforeEach(async () => {
  await Promise.all(db.tables.map((table) => table.clear()))
})
afterEach(cleanup)

test('previews a CSV and imports its products', async () => {
  const user = userEvent.setup()
  render(
    <Router hook={memoryLocation({ path: '/import' }).hook}>
      <AppRoutes />
    </Router>,
  )
  const csv = new File(['name,price,cost\nCoke 1.5L,75,62\nSprite 1L,60,50'], 'products.csv', {
    type: 'text/csv',
  })

  await user.upload(screen.getByLabelText('Choose CSV file'), csv)
  expect(await screen.findByText('2 products ready to import')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Import 2 products' }))

  expect(await screen.findByText('Imported 2 products.')).toBeInTheDocument()
  expect(await db.products.count()).toBe(2)
})
