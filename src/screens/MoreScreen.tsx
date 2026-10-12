import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState, type ChangeEvent } from 'react'
import { Link } from 'wouter'
import { OWNER, STORE_NAME } from '../brand'
import { useCart } from '../cart-context'
import { lastBackupAt, parseBackup, restoreBackup, type BackupFile } from '../data/backup'
import { salesBetween, voidSale } from '../data/sales'
import { db, type Sale } from '../db'
import { daysSince, formatDay, formatTime, rangeFor } from '../domain/dates'
import { formatPesos } from '../money'
import { shareBackup } from '../share-backup'
import { ConfirmSheet, Notice, Screen } from '../ui'
import { btn, errorMessage } from '../ui-kit'

const BACKUP_REMINDER_DAYS = 7

async function restoreMessage(backup: BackupFile): Promise<string> {
  const [products, sales, customers, newerSales] = await Promise.all([
    db.products.count(),
    db.sales.count(),
    db.customers.count(),
    db.sales.where('createdAt').above(backup.exportedAt).count(),
  ])
  const { tables } = backup
  const warning =
    newerSales > 0 ? ' This phone has sales newer than this backup. They will be lost.' : ''
  return `Backup from ${formatDay(backup.exportedAt)}, ${formatTime(backup.exportedAt)}: ${tables.products.length} products, ${tables.sales.length} sales, ${tables.customers.length} customers. On this phone now: ${products} products, ${sales} sales, ${customers} customers. Everything now on this phone will be replaced.${warning}`
}

export function MoreScreen() {
  const { setCart } = useCart()
  const [now] = useState(() => new Date())
  const lastBackup = useLiveQuery(() => lastBackupAt(db), [])
  const today = useLiveQuery(() => {
    const { start, end } = rangeFor('today', new Date())
    return salesBetween(db, start, end)
  }, [])
  const customers = useLiveQuery(() => db.customers.toArray(), [])
  const [persisted, setPersisted] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState<{ backup: BackupFile; message: string } | null>(null)
  const [voiding, setVoiding] = useState<Sale | null>(null)

  useEffect(() => {
    navigator.storage?.persisted?.().then(setPersisted, (caught: unknown) => {
      console.error(caught)
      setPersisted(false)
    })
  }, [])

  // useLiveQuery gives undefined while loading; lastBackupAt gives null when there is none.
  const backupDays = lastBackup ? daysSince(lastBackup, now) : null
  const needsBackup =
    lastBackup === null || (backupDays !== null && backupDays >= BACKUP_REMINDER_DAYS)

  async function backupNow() {
    setBusy(true)
    setMessage('')
    setError('')
    try {
      const result = await shareBackup(db)
      if (result !== 'cancelled') setMessage('Backup saved. Keep the file somewhere safe.')
    } catch (caught) {
      setError(errorMessage(caught))
    } finally {
      setBusy(false)
    }
  }

  async function pickRestoreFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setMessage('')
    setError('')
    try {
      const result = parseBackup(await file.text())
      if (result.ok)
        setPending({ backup: result.backup, message: await restoreMessage(result.backup) })
      else setError(result.error)
    } catch (caught) {
      setError(errorMessage(caught))
    }
  }

  const sales = [...(today?.sales ?? [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const customerName = (id: string | null) =>
    customers?.find((customer) => customer.id === id)?.name ?? 'customer'
  const itemCount = (saleId: string) =>
    today?.items.filter((item) => item.saleId === saleId).length ?? 0

  return (
    <Screen
      title="More"
      nav
      footer={
        <p className="py-2 text-center text-xs text-slate-400">
          {STORE_NAME} · made with ❤️ for {OWNER}
        </p>
      }
    >
      {needsBackup && (
        <Notice tone="warn">
          ⚠ {lastBackup === null ? 'No backup yet.' : `Last backup: ${backupDays} days ago.`} Tap
          Backup now and send the file to your son.
        </Notice>
      )}
      {persisted === false && (
        <Notice tone="bad">
          This phone may delete the store data when storage runs low. Back up often.
        </Notice>
      )}
      <button type="button" className={btn.primary} disabled={busy} onClick={backupNow}>
        Backup now (send file)
      </button>
      <label className={`${btn.ghost} block`}>
        Restore from backup
        <input
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={pickRestoreFile}
        />
      </label>
      <Link href="/import" className={`${btn.ghost} block`}>
        Import products (CSV)
      </Link>
      {message && <Notice tone="good">{message}</Notice>}
      {error && <Notice tone="bad">{error}</Notice>}

      <p className="text-xs font-semibold tracking-wide text-slate-500">TODAY'S SALES</p>
      <ul className="divide-y divide-slate-100">
        {sales.map((sale) => (
          <li key={sale.id} className="flex items-center justify-between py-2">
            <span className={sale.voidedAt ? 'text-slate-400 line-through' : ''}>
              {formatPesos(sale.total)} ·{' '}
              {sale.payment === 'cash' ? 'Cash' : `Utang (${customerName(sale.customerId)})`}
              <span className="block text-xs text-slate-500 no-underline">
                {formatTime(sale.createdAt)} · {itemCount(sale.id)} items
              </span>
            </span>
            {sale.voidedAt ? (
              <span className="text-xs text-slate-400">voided</span>
            ) : (
              <button
                type="button"
                className="text-sm text-slate-500"
                onClick={() => setVoiding(sale)}
              >
                Void
              </button>
            )}
          </li>
        ))}
      </ul>
      {sales.length === 0 && <p className="text-sm text-slate-500">No sales yet today.</p>}

      {pending && (
        <ConfirmSheet
          title="Restore this backup?"
          message={pending.message}
          confirmLabel="Replace and restore"
          danger
          onConfirm={async () => {
            await restoreBackup(db, pending.backup)
            setCart([])
            setMessage('Backup restored.')
          }}
          onClose={() => setPending(null)}
        />
      )}
      {voiding && (
        <ConfirmSheet
          title={`Void this ${formatPesos(voiding.total)} sale?`}
          message="The items go back into stock. The sale stays in the records, marked voided."
          confirmLabel="Void sale"
          danger
          onConfirm={() => voidSale(db, voiding.id)}
          onClose={() => setVoiding(null)}
        />
      )}
    </Screen>
  )
}
