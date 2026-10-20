import { exportBackup, markBackedUp, type BackupTables } from './data/backup'
import type { StoreDb } from './db'

const URL_KEY = 'syncUrl'
const SECRET_KEY = 'syncKey'
const NAME_KEY = 'syncName' // which phone, so each phone gets its own Drive files
const SCRIPT_HOST = 'https://script.google.com/' // only the owner's Apps Script, never elsewhere
const AT_KEY = 'driveBackupAt'
const HASH_KEY = 'driveBackupHash'
export const BACKUP_EVERY_MS = 60 * 60 * 1000

/**
 * Saves the setup from a link like #sync=<script URL>&key=<secret>&name=<phone>. True when there
 * was one. The name is optional and cleaned to fit in a file name.
 */
export async function saveSetupFromHash(db: StoreDb, hash: string): Promise<boolean> {
  const params = new URLSearchParams(hash.replace(/^#/, ''))
  const url = params.get('sync')
  const key = params.get('key')
  if (!url?.startsWith(SCRIPT_HOST) || !key) return false
  const name = (params.get('name') ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .slice(0, 20)
  await db.settings.bulkPut([
    { key: URL_KEY, value: url },
    { key: SECRET_KEY, value: key },
    { key: NAME_KEY, value: name },
  ])
  return true
}

/**
 * Uploads the backup to the owner's Apps Script when the setup link was opened, the phone is
 * online, the last upload was an hour or more ago, and the store data changed since then.
 */
export async function backUpToDriveIfDue(
  db: StoreDb,
  now = new Date(),
  send: typeof fetch = fetch,
): Promise<'uploaded' | 'skipped'> {
  const [url, key, name = '', at, lastHash] = await Promise.all(
    [URL_KEY, SECRET_KEY, NAME_KEY, AT_KEY, HASH_KEY].map(
      async (name) => (await db.settings.get(name))?.value,
    ),
  )
  if (!url || !key || navigator.onLine === false) return 'skipped'
  // A last upload in the future means the clock was set back; don't wait for it to catch up.
  const sinceLast = at ? now.getTime() - Date.parse(at) : Infinity
  if (sinceLast >= 0 && sinceLast < BACKUP_EVERY_MS) return 'skipped'

  const backup = await exportBackup(db, now)
  const hash = await fingerprint(backup.tables)
  if (hash === lastHash) return 'skipped'

  const gzip = await gzipBase64(JSON.stringify(backup))
  const response = await send(url, {
    method: 'POST',
    body: JSON.stringify({ key, name, exportedAt: backup.exportedAt, gzip }),
  })
  const reply: unknown = await response.json()
  if (!response.ok || (reply as { ok?: unknown } | null)?.ok !== true) {
    throw new Error(`Drive backup failed (HTTP ${response.status}): ${JSON.stringify(reply)}`)
  }
  await db.settings.bulkPut([
    { key: AT_KEY, value: now.toISOString() },
    { key: HASH_KEY, value: hash },
  ])
  await markBackedUp(db, now)
  return 'uploaded'
}

/** Settings are left out, so a sort choice or this file's own keys don't count as a change. */
async function fingerprint(tables: BackupTables): Promise<string> {
  const data = new TextEncoder().encode(JSON.stringify({ ...tables, settings: [] }))
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

async function gzipBase64(text: string): Promise<string> {
  const stream = new Response(text).body!.pipeThrough(new CompressionStream('gzip'))
  const bytes = new Uint8Array(await new Response(stream).arrayBuffer())
  // In chunks: spreading a big array into fromCharCode overflows the call stack.
  let binary = ''
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  }
  return btoa(binary)
}
