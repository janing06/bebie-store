import { STORE_NAME } from './brand'
import { backupFileName, exportBackup, markBackedUp } from './data/backup'
import type { StoreDb } from './db'

export type ShareResult = 'shared' | 'downloaded' | 'cancelled'

/** Opens Android's share sheet with the backup file, or downloads it where sharing isn't possible. */
export async function shareBackup(db: StoreDb, now = new Date()): Promise<ShareResult> {
  const backup = await exportBackup(db, now)
  // The content is JSON, but Chrome refuses to share .json files (NotAllowedError)
  // even when canShare() says yes, so the file goes out as plain text.
  const file = new File([JSON.stringify(backup)], backupFileName(now), { type: 'text/plain' })

  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: `${STORE_NAME} backup` })
      await markBackedUp(db, now)
      return 'shared'
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled'
      // The browser refused this file: save it to Downloads instead of losing the backup.
      if (!(error instanceof DOMException && error.name === 'NotAllowedError')) throw error
    }
  }

  const url = URL.createObjectURL(file)
  const link = document.createElement('a')
  link.href = url
  link.download = file.name
  link.click()
  URL.revokeObjectURL(url)
  await markBackedUp(db, now)
  return 'downloaded'
}
