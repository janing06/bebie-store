import { expect, test } from 'vitest'
import { saveSetupFromHash } from './drive-backup'
import { freshDb } from './test/helpers'

const SCRIPT_URL = 'https://script.google.com/macros/s/abc/exec'
const SETUP_HASH = `#sync=${encodeURIComponent(SCRIPT_URL)}&key=s3cret`

test('the setup link saves the script URL and key', async () => {
  const db = freshDb()

  expect(await saveSetupFromHash(db, SETUP_HASH)).toBe(true)

  expect(await db.settings.get('syncUrl')).toEqual({ key: 'syncUrl', value: SCRIPT_URL })
  expect(await db.settings.get('syncKey')).toEqual({ key: 'syncKey', value: 's3cret' })
})

test.each(['', '#sync=', `#sync=${encodeURIComponent(SCRIPT_URL)}`, '#sync=http://x.com&key=k'])(
  'a link without a valid setup saves nothing: %s',
  async (hash) => {
    const db = freshDb()

    expect(await saveSetupFromHash(db, hash)).toBe(false)
    expect(await db.settings.count()).toBe(0)
  },
)
