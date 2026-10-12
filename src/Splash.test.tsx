// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, test } from 'vitest'
import { Splash } from './Splash'

afterEach(cleanup)

test('shows the store name and greets Bebie', () => {
  render(<Splash />)
  expect(screen.getByRole('heading', { name: "Bebie's Store" })).toBeInTheDocument()
  expect(screen.getByText(/^Good (morning|afternoon|evening), Bebie!$/)).toBeInTheDocument()
})
