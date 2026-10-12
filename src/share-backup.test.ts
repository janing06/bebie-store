// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from 'vitest'
import { lastBackupAt } from './data/backup'
import { shareBackup } from './share-backup'
import { freshDb } from './test/helpers'

function supportFileSharing(share: (data: ShareData) => Promise<void>) {
  Object.defineProperty(navigator, 'canShare', { value: () => true, configurable: true })
  Object.defineProperty(navigator, 'share', { value: share, configurable: true })
}

afterEach(() => {
  Reflect.deleteProperty(navigator, 'canShare')
  Reflect.deleteProperty(navigator, 'share')
  vi.restoreAllMocks()
})

describe('shareBackup', () => {
  test('shares the backup file and remembers the backup date', async () => {
    const db = freshDb()
    const share = vi.fn(async (_data: ShareData) => {})
    supportFileSharing(share)

    expect(await shareBackup(db)).toBe('shared')
    expect(share.mock.calls[0][0].files?.[0].name).toMatch(/^bebie-store-backup-.*\.json$/)
    expect(await lastBackupAt(db)).not.toBeNull()
  })

  test('a cancelled share is not counted as a backup', async () => {
    const db = freshDb()
    supportFileSharing(async () => {
      throw new DOMException('Share canceled', 'AbortError')
    })

    expect(await shareBackup(db)).toBe('cancelled')
    expect(await lastBackupAt(db)).toBeNull()
  })

  test('other share failures are reported', async () => {
    const db = freshDb()
    supportFileSharing(async () => {
      throw new Error('Share failed')
    })
    await expect(shareBackup(db)).rejects.toThrow('Share failed')
  })

  test('downloads the file when the phone cannot share files', async () => {
    const db = freshDb()
    URL.createObjectURL = vi.fn(() => 'blob:backup')
    URL.revokeObjectURL = vi.fn()
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    expect(await shareBackup(db)).toBe('downloaded')
    expect(click).toHaveBeenCalledOnce()
    expect(await lastBackupAt(db)).not.toBeNull()
  })
})
