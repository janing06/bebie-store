import type { StoreDb } from './db'

const URL_KEY = 'syncUrl'
const SECRET_KEY = 'syncKey'

/** Saves the setup from a link like #sync=<script URL>&key=<secret>. True when there was one. */
export async function saveSetupFromHash(db: StoreDb, hash: string): Promise<boolean> {
  const params = new URLSearchParams(hash.replace(/^#/, ''))
  const url = params.get('sync')
  const key = params.get('key')
  if (!url?.startsWith('https://') || !key) return false
  await db.settings.bulkPut([
    { key: URL_KEY, value: url },
    { key: SECRET_KEY, value: key },
  ])
  return true
}
