import { afterEach, expect, test, vi } from 'vitest'
import { lastBackupAt } from './data/backup'
import { saveAllProductsSort } from './data/preferences'
import { addProduct } from './data/products'
import type { StoreDb } from './db'
import { BACKUP_EVERY_MS, backUpToDriveIfDue, saveSetupFromHash } from './drive-backup'
import { freshDb, sampleProduct } from './test/helpers'

const SCRIPT_URL = 'https://script.google.com/macros/s/abc/exec'
const SETUP_HASH = `#sync=${encodeURIComponent(SCRIPT_URL)}&key=s3cret`

test('the setup link saves the script URL and key', async () => {
  const db = freshDb()

  expect(await saveSetupFromHash(db, SETUP_HASH)).toBe(true)

  expect(await db.settings.get('syncUrl')).toEqual({ key: 'syncUrl', value: SCRIPT_URL })
  expect(await db.settings.get('syncKey')).toEqual({ key: 'syncKey', value: 's3cret' })
})

test.each([
  '',
  '#sync=',
  `#sync=${encodeURIComponent(SCRIPT_URL)}`,
  '#sync=http://x.com&key=k',
  '#sync=https://evil.example/exec&key=k',
])('a link without a valid setup saves nothing: %s', async (hash) => {
  const db = freshDb()

  expect(await saveSetupFromHash(db, hash)).toBe(false)
  expect(await db.settings.count()).toBe(0)
})

const NOW = new Date('2026-10-15T02:00:00Z')
const minutesLater = (minutes: number) => new Date(NOW.getTime() + minutes * 60_000)

afterEach(() => vi.unstubAllGlobals())

function fakeScript(reply: unknown = { ok: true }) {
  return vi.fn<typeof fetch>(async () => Response.json(reply))
}

async function setUpStore(): Promise<StoreDb> {
  const db = freshDb()
  await addProduct(db, sampleProduct())
  await saveSetupFromHash(db, SETUP_HASH)
  return db
}

async function sentBackup(send: ReturnType<typeof fakeScript>, call = 0) {
  const [, init] = send.mock.calls[call]
  const body = JSON.parse(String(init?.body)) as {
    key: string
    name: string
    exportedAt: string
    gzip: string
  }
  const bytes = Uint8Array.from(atob(body.gzip), (char) => char.charCodeAt(0))
  const json = await new Response(
    new Response(bytes).body!.pipeThrough(new DecompressionStream('gzip')),
  ).text()
  return { ...body, backup: JSON.parse(json) }
}

test('the hourly limit is one hour', () => {
  expect(BACKUP_EVERY_MS).toBe(60 * 60 * 1000)
})

test('the setup link saves the phone name, cleaned for a file name', async () => {
  const db = freshDb()

  await saveSetupFromHash(db, `${SETUP_HASH}&name=${encodeURIComponent('Jan Phone!')}`)

  expect(await db.settings.get('syncName')).toEqual({ key: 'syncName', value: 'jan-phone' })
})

test('the phone name is sent with each backup', async () => {
  const db = freshDb()
  await saveSetupFromHash(db, `${SETUP_HASH}&name=mom`)
  const send = fakeScript()

  await backUpToDriveIfDue(db, NOW, send)

  expect((await sentBackup(send)).name).toBe('mom')
})

test('a link without a name sends an empty name', async () => {
  const db = await setUpStore()
  const send = fakeScript()

  await backUpToDriveIfDue(db, NOW, send)

  expect((await sentBackup(send)).name).toBe('')
})

test('uploads the backup to the script and counts it as backed up', async () => {
  const db = await setUpStore()
  const send = fakeScript()

  expect(await backUpToDriveIfDue(db, NOW, send)).toBe('uploaded')

  expect(send).toHaveBeenCalledWith(SCRIPT_URL, expect.objectContaining({ method: 'POST' }))
  const sent = await sentBackup(send)
  expect(sent.key).toBe('s3cret')
  expect(sent.exportedAt).toBe(NOW.toISOString())
  expect(sent.backup.tables.products).toHaveLength(1)
  expect(await lastBackupAt(db)).toBe(NOW.toISOString())
})

test('does nothing until the setup link was opened', async () => {
  const db = freshDb()
  const send = fakeScript()

  expect(await backUpToDriveIfDue(db, NOW, send)).toBe('skipped')
  expect(send).not.toHaveBeenCalled()
})

test('does nothing while offline', async () => {
  const db = await setUpStore()
  const send = fakeScript()
  vi.stubGlobal('navigator', { onLine: false })

  expect(await backUpToDriveIfDue(db, NOW, send)).toBe('skipped')
  expect(send).not.toHaveBeenCalled()
})

test('waits an hour after an upload, even when the data changed', async () => {
  const db = await setUpStore()
  const send = fakeScript()
  await backUpToDriveIfDue(db, NOW, send)
  await addProduct(db, sampleProduct({ name: 'Ice' }))

  expect(await backUpToDriveIfDue(db, minutesLater(59), send)).toBe('skipped')
  expect(await backUpToDriveIfDue(db, minutesLater(60), send)).toBe('uploaded')
})

test('skips when the store data did not change', async () => {
  const db = await setUpStore()
  const send = fakeScript()
  await backUpToDriveIfDue(db, NOW, send)

  expect(await backUpToDriveIfDue(db, minutesLater(120), send)).toBe('skipped')
  expect(send).toHaveBeenCalledTimes(1)
})

test('a settings change alone does not count as a change', async () => {
  const db = await setUpStore()
  const send = fakeScript()
  await backUpToDriveIfDue(db, NOW, send)
  await saveAllProductsSort(db, 'best')

  expect(await backUpToDriveIfDue(db, minutesLater(120), send)).toBe('skipped')
})

test('a last upload in the future does not block (phone clock was set back)', async () => {
  const db = await setUpStore()
  const send = fakeScript()
  await backUpToDriveIfDue(db, minutesLater(24 * 60), send)
  await addProduct(db, sampleProduct({ name: 'Ice' }))

  expect(await backUpToDriveIfDue(db, NOW, send)).toBe('uploaded')
})

test('a failed upload changes nothing, so the next try sends again', async () => {
  const db = await setUpStore()
  const send = vi.fn<typeof fetch>().mockRejectedValueOnce(new TypeError('Failed to fetch'))
  send.mockResolvedValue(Response.json({ ok: true }))

  await expect(backUpToDriveIfDue(db, NOW, send)).rejects.toThrow('Failed to fetch')
  expect(await lastBackupAt(db)).toBeNull()

  expect(await backUpToDriveIfDue(db, NOW, send)).toBe('uploaded')
})

test('a script that says no is a failure', async () => {
  const db = await setUpStore()

  await expect(
    backUpToDriveIfDue(db, NOW, fakeScript({ ok: false, error: 'wrong key' })),
  ).rejects.toThrow(/Drive backup failed.*wrong key/)
  expect(await lastBackupAt(db)).toBeNull()
})

test('a non-JSON reply is a failure', async () => {
  const db = await setUpStore()
  const send = vi.fn<typeof fetch>(async () => new Response('<html>Error</html>', { status: 500 }))

  await expect(backUpToDriveIfDue(db, NOW, send)).rejects.toThrow()
  expect(await lastBackupAt(db)).toBeNull()
})

test('a big store uploads', async () => {
  const db = await setUpStore()
  await db.stockMoves.bulkAdd(
    Array.from({ length: 10_000 }, () => ({
      id: crypto.randomUUID(),
      productId: crypto.randomUUID(),
      change: 1,
      reason: 'restock' as const,
      saleId: null,
      note: null,
      createdAt: NOW.toISOString(),
    })),
  )
  const send = fakeScript()

  expect(await backUpToDriveIfDue(db, NOW, send)).toBe('uploaded')
  expect((await sentBackup(send)).backup.tables.stockMoves).toHaveLength(10_001) // plus the starting stock
})
