import { useEffect } from 'react'
import type { StoreDb } from './db'
import { BACKUP_EVERY_MS, backUpToDriveIfDue, saveSetupFromHash } from './drive-backup'

let running = false // module-wide, so StrictMode's double effect can't upload twice

async function tryBackup(db: StoreDb): Promise<void> {
  if (running) return
  running = true
  try {
    await backUpToDriveIfDue(db)
  } catch (error) {
    console.error('Drive backup failed', error) // silent on purpose: Mom never sees this
  } finally {
    running = false
  }
}

/** Backs the store up to Drive in the background: on start, hourly, back online, and when hidden. */
export function useDriveBackup(db: StoreDb): void {
  useEffect(() => {
    const attempt = () => void tryBackup(db)
    const onHidden = () => {
      if (document.visibilityState === 'hidden') attempt()
    }

    saveSetupFromHash(db, window.location.hash)
      .then((saved) => {
        if (saved) window.history.replaceState(window.history.state, '', window.location.pathname)
      })
      .catch((error: unknown) => console.error('Saving the Drive backup setup failed', error))
      .finally(attempt)
    const timer = setInterval(attempt, BACKUP_EVERY_MS)
    window.addEventListener('online', attempt)
    document.addEventListener('visibilitychange', onHidden)
    return () => {
      clearInterval(timer)
      window.removeEventListener('online', attempt)
      document.removeEventListener('visibilitychange', onHidden)
    }
  }, [db])
}
