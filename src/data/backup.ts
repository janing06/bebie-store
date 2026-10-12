import {
  STOCK_REASONS,
  type Customer,
  type Product,
  type Sale,
  type SaleItem,
  type Setting,
  type StockMove,
  type StoreDb,
  type UtangPayment,
} from '../db'
import { toYmd } from '../domain/dates'

export const FORMAT_VERSION = 1
const APP_ID = 'bebie-store'
const LAST_BACKUP_KEY = 'lastBackupAt'

export interface BackupTables {
  products: Product[]
  sales: Sale[]
  saleItems: SaleItem[]
  stockMoves: StockMove[]
  customers: Customer[]
  payments: UtangPayment[]
  settings: Setting[]
}

export interface BackupFile {
  app: typeof APP_ID
  formatVersion: number
  exportedAt: string
  tables: BackupTables
}

export type ParsedBackup = { ok: true; backup: BackupFile } | { ok: false; error: string }

export async function exportBackup(db: StoreDb, now = new Date()): Promise<BackupFile> {
  const tables = await db.transaction('r', db.tables, async () => {
    const [products, sales, saleItems, stockMoves, customers, payments, settings] =
      await Promise.all([
        db.products.toArray(),
        db.sales.toArray(),
        db.saleItems.toArray(),
        db.stockMoves.toArray(),
        db.customers.toArray(),
        db.payments.toArray(),
        db.settings.toArray(),
      ])
    return { products, sales, saleItems, stockMoves, customers, payments, settings }
  })
  return { app: APP_ID, formatVersion: FORMAT_VERSION, exportedAt: now.toISOString(), tables }
}

type FieldType = 'string' | 'string?' | 'int' | 'int?' | 'boolean'

const SCHEMA: Record<keyof BackupTables, Record<string, FieldType>> = {
  products: {
    id: 'string',
    name: 'string',
    price: 'int',
    cost: 'int?',
    stock: 'int',
    lowStockAt: 'int?',
    packSize: 'int?',
    favorite: 'boolean',
    active: 'boolean',
    createdAt: 'string',
    updatedAt: 'string',
  },
  sales: {
    id: 'string',
    createdAt: 'string',
    payment: 'string',
    customerId: 'string?',
    total: 'int',
    cashReceived: 'int?',
    voidedAt: 'string?',
  },
  saleItems: {
    id: 'string',
    saleId: 'string',
    productId: 'string',
    name: 'string',
    qty: 'int',
    price: 'int',
    cost: 'int?',
  },
  stockMoves: {
    id: 'string',
    productId: 'string',
    change: 'int',
    reason: 'string',
    saleId: 'string?',
    note: 'string?',
    createdAt: 'string',
  },
  customers: {
    id: 'string',
    name: 'string',
    note: 'string?',
    active: 'boolean',
    createdAt: 'string',
  },
  payments: { id: 'string', customerId: 'string', amount: 'int', createdAt: 'string' },
  settings: { key: 'string', value: 'string' },
}

function fieldMatches(value: unknown, type: FieldType): boolean {
  switch (type) {
    case 'string':
      return typeof value === 'string'
    case 'string?':
      return value === null || typeof value === 'string'
    case 'int':
      return Number.isInteger(value)
    case 'int?':
      return value === null || Number.isInteger(value)
    case 'boolean':
      return typeof value === 'boolean'
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function fail(error: string): ParsedBackup {
  return { ok: false, error }
}

/** Checks everything about a backup file before anything on the phone is touched. */
export function parseBackup(text: string): ParsedBackup {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    return fail('This is not a valid backup file.')
  }
  if (!isRecord(data) || data.app !== APP_ID)
    return fail("This is not a Bebie's Store backup file.")
  if (data.formatVersion !== FORMAT_VERSION) {
    return fail(`This backup uses an unsupported version (${String(data.formatVersion)}).`)
  }
  if (typeof data.exportedAt !== 'string' || !isRecord(data.tables)) {
    return fail('The backup file is incomplete.')
  }
  for (const [table, fields] of Object.entries(SCHEMA)) {
    const rows = data.tables[table]
    if (!Array.isArray(rows)) return fail(`The backup is missing the ${table} table.`)
    for (const [index, row] of rows.entries()) {
      const badField = isRecord(row)
        ? Object.entries(fields).find(([field, type]) => !fieldMatches(row[field], type))?.[0]
        : 'row'
      if (badField)
        return fail(`${table} row ${index + 1}: "${badField}" is missing or has the wrong type.`)
    }
  }
  // Every field now has the right type, so the shape matches BackupFile.
  const backup = data as unknown as BackupFile
  const problem = findDataProblem(backup.tables)
  return problem ? fail(problem) : { ok: true, backup }
}

function findDuplicateKey(tables: BackupTables): string | null {
  for (const [table, rows] of Object.entries(tables) as [
    keyof BackupTables,
    { id?: string; key?: string }[],
  ][]) {
    const field = table === 'settings' ? 'key' : 'id'
    const seen = new Set<string>()
    for (const row of rows) {
      const value = String(row[field])
      if (seen.has(value)) return `${table} has two rows with the same ${field}: ${value}.`
      seen.add(value)
    }
  }
  return null
}

function findDataProblem(tables: BackupTables): string | null {
  const duplicate = findDuplicateKey(tables)
  if (duplicate) return duplicate

  const productIds = new Set(tables.products.map((p) => p.id))
  const saleIds = new Set(tables.sales.map((s) => s.id))
  const customerIds = new Set(tables.customers.map((c) => c.id))

  for (const sale of tables.sales) {
    if (sale.payment !== 'cash' && sale.payment !== 'utang') {
      return `Sale ${sale.id} has an unknown payment type.`
    }
    if (sale.customerId !== null && !customerIds.has(sale.customerId)) {
      return `Sale ${sale.id} points to a missing customer.`
    }
  }
  for (const item of tables.saleItems) {
    if (!saleIds.has(item.saleId) || !productIds.has(item.productId)) {
      return `Sale item ${item.id} points to a missing sale or product.`
    }
  }
  for (const move of tables.stockMoves) {
    if (!STOCK_REASONS.includes(move.reason))
      return `Stock change ${move.id} has an unknown reason.`
    if (!productIds.has(move.productId) || (move.saleId !== null && !saleIds.has(move.saleId))) {
      return `Stock change ${move.id} points to a missing product or sale.`
    }
  }
  for (const payment of tables.payments) {
    if (!customerIds.has(payment.customerId))
      return `Payment ${payment.id} points to a missing customer.`
  }
  const moveTotals = new Map<string, number>()
  for (const move of tables.stockMoves) {
    moveTotals.set(move.productId, (moveTotals.get(move.productId) ?? 0) + move.change)
  }
  for (const product of tables.products) {
    if (product.stock !== (moveTotals.get(product.id) ?? 0)) {
      return `Stock for ${product.name} does not match its history.`
    }
  }
  return null
}

/** Replaces everything on the phone with the backup. Call only with a parsed backup. */
export async function restoreBackup(db: StoreDb, backup: BackupFile): Promise<void> {
  const { tables } = backup
  await db.transaction('rw', db.tables, async () => {
    await Promise.all(db.tables.map((table) => table.clear()))
    await db.products.bulkAdd(tables.products)
    await db.sales.bulkAdd(tables.sales)
    await db.saleItems.bulkAdd(tables.saleItems)
    await db.stockMoves.bulkAdd(tables.stockMoves)
    await db.customers.bulkAdd(tables.customers)
    await db.payments.bulkAdd(tables.payments)
    await db.settings.bulkAdd(tables.settings)
  })
}

export async function markBackedUp(db: StoreDb, now = new Date()): Promise<void> {
  await db.settings.put({ key: LAST_BACKUP_KEY, value: now.toISOString() })
}

export async function lastBackupAt(db: StoreDb): Promise<string | null> {
  return (await db.settings.get(LAST_BACKUP_KEY))?.value ?? null
}

export function backupFileName(now: Date): string {
  const time = `${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`
  return `bebie-store-backup-${toYmd(now)}-${time}.txt`
}
