// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { addProduct } from './data/products'
import type { StoreDb } from './db'
import { saveSetupFromHash } from './drive-backup'
import { freshDb, sampleProduct } from './test/helpers'
import { useDriveBackup } from './use-drive-backup'

const SETUP_HASH = `#sync=${encodeURIComponent('https://script.google.com/macros/s/abc/exec')}&key=k`

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  window.history.replaceState(null, '', '/')
})

function Probe({ db }: { db: StoreDb }) {
  useDriveBackup(db)
  return null
}

function stubScript() {
  const send = vi.fn<typeof fetch>(async () => Response.json({ ok: true }))
  vi.stubGlobal('fetch', send)
  return send
}

test('the setup link is saved, cleared from the address bar, and the first backup sent', async () => {
  const db = freshDb()
  const send = stubScript()
  window.history.replaceState(null, '', `/${SETUP_HASH}`)

  const { container } = render(<Probe db={db} />)

  await vi.waitFor(() => expect(send).toHaveBeenCalledTimes(1))
  expect(window.location.hash).toBe('')
  expect(await db.settings.get('syncKey')).toEqual({ key: 'syncKey', value: 'k' })
  expect(container).toBeEmptyDOMElement()
})

test('putting the app away tries a backup', async () => {
  const db = freshDb()
  const send = stubScript()
  render(<Probe db={db} />)
  await saveSetupFromHash(db, SETUP_HASH)

  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
  document.dispatchEvent(new Event('visibilitychange'))

  await vi.waitFor(() => expect(send).toHaveBeenCalledTimes(1))
})

test('overlapping tries upload once', async () => {
  const db = freshDb()
  const send = stubScript()
  await saveSetupFromHash(db, SETUP_HASH)
  await addProduct(db, sampleProduct())

  render(<Probe db={db} />) // tries on start
  window.dispatchEvent(new Event('online')) // and again right away

  await vi.waitFor(() => expect(send).toHaveBeenCalled())
  await new Promise((resolve) => setTimeout(resolve, 50))
  expect(send).toHaveBeenCalledTimes(1)
})

test('a failed backup is only logged, never shown', async () => {
  const db = freshDb()
  vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockRejectedValue(new TypeError('Failed to fetch')))
  const logged = vi.spyOn(console, 'error').mockImplementation(() => {})
  window.history.replaceState(null, '', `/${SETUP_HASH}`)

  const { container } = render(<Probe db={db} />)

  await vi.waitFor(() =>
    expect(logged).toHaveBeenCalledWith('Drive backup failed', expect.any(TypeError)),
  )
  expect(container).toBeEmptyDOMElement()
})
