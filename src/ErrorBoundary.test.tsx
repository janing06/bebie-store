// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { ErrorBoundary } from './ErrorBoundary'

afterEach(cleanup)

function Broken(): never {
  throw new Error('Something broke')
}

test('shows the error and a way to back up the data', () => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  render(
    <ErrorBoundary>
      <Broken />
    </ErrorBoundary>,
  )
  expect(screen.getByText('Something broke')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Backup now' })).toBeInTheDocument()
})
