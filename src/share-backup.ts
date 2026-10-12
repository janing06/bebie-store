import { STORE_NAME } from './brand'
import { backupFileName, exportBackup, markBackedUp } from './data/backup'
import type { StoreDb } from './db'

export type ShareResult = 'shared' | 'downloaded' | 'cancelled'

/** Opens Android's share sheet with the backup file, or downloads it where sharing files is unsupported. */
export async function shareBackup(db: StoreDb, now = new Date()): Promise<ShareResult> {
  const backup = await exportBackup(db, now)
  const file = new File([JSON.stringify(backup)], backupFileName(now), { type: 'application/json' })

  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: `${STORE_NAME} backup` })
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled'
      throw error
    }
    await markBackedUp(db, now)
    return 'shared'
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
