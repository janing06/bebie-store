import { describe, expect, test } from 'vitest'
import type { StoreDb } from '../db'
import { addToCart } from '../domain/cart'
import { freshDb, sampleProduct } from '../test/helpers'
import {
  backupFileName,
  exportBackup,
  lastBackupAt,
  markBackedUp,
  parseBackup,
  restoreBackup,
  type BackupFile,
} from './backup'
import { addProduct } from './products'
import { checkout, voidSale } from './sales'
import { adjustStock } from './stock'
import { addCustomer, recordPayment } from './utang'

const NOW = new Date('2026-10-12T09:30:00Z')

async function seed(db: StoreDb) {
  const coke = await addProduct(db, sampleProduct({ startingStock: 10 }))
  const ice = await addProduct(
    db,
    sampleProduct({ name: 'Ice', price: 500, cost: null, startingStock: 0 }),
  )
  const nena = await addCustomer(db, 'Aling Nena', 'near the chapel')
  await checkout(db, { cart: addToCart([], coke, 2), payment: 'cash', cashReceived: 20000 })
  const credit = await checkout(db, {
    cart: addToCart(addToCart([], coke, 1), ice, 3),
    payment: 'utang',
    customerId: nena.id,
  })
  await recordPayment(db, nena.id, 5000)
  const voided = await checkout(db, {
    cart: addToCart([], ice, 1),
    payment: 'cash',
    cashReceived: 500,
  })
  await voidSale(db, voided.id)
  await adjustStock(db, coke.id, 5, 'family')
  await markBackedUp(db, NOW)
  return { credit }
}

function roundTrip(backup: BackupFile): BackupFile {
  const parsed = parseBackup(JSON.stringify(backup))
  if (!parsed.ok) throw new Error(parsed.error)
  return parsed.backup
}

describe('exportBackup', () => {
  test('includes the header and every table', async () => {
    const db = freshDb()
    await seed(db)
    const backup = await exportBackup(db, NOW)

    expect(backup).toMatchObject({
      app: 'bebie-store',
      formatVersion: 1,
      exportedAt: '2026-10-12T09:30:00.000Z',
    })
    expect(Object.keys(backup.tables).sort()).toEqual(
      ['customers', 'payments', 'products', 'saleItems', 'sales', 'settings', 'stockMoves'].sort(),
    )
    expect(backup.tables.products).toHaveLength(2)
  })
})

describe('backup → restore', () => {
  test('produces identical data in an empty database', async () => {
    const source = freshDb()
    await seed(source)
    const original = await exportBackup(source, NOW)

    const target = freshDb()
    await restoreBackup(target, roundTrip(original))

    expect(await exportBackup(target, NOW)).toEqual(original)
  })

  test('replaces whatever was there before', async () => {
    const source = freshDb()
    await seed(source)
    const target = freshDb()
    await addProduct(target, sampleProduct({ name: 'Old product' }))

    await restoreBackup(target, roundTrip(await exportBackup(source, NOW)))

    const names = (await target.products.toArray()).map((p) => p.name).sort()
    expect(names).toEqual(['Coke 1.5L', 'Ice'])
  })
})

describe('parseBackup rejects bad files', () => {
  async function validJson(): Promise<Record<string, unknown>> {
    const db = freshDb()
    await seed(db)
    return JSON.parse(JSON.stringify(await exportBackup(db, NOW)))
  }

  function expectRejected(data: unknown, message: RegExp) {
    const result = parseBackup(typeof data === 'string' ? data : JSON.stringify(data))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(message)
  }

  test('not JSON', () => expectRejected('hello', /not a valid backup/i))
  test('another app', () => expectRejected({ app: 'other' }, /not a Bebie's Store backup/i))

  test('unknown format version', async () => {
    expectRejected({ ...(await validJson()), formatVersion: 2 }, /version/i)
  })

  test('missing table', async () => {
    const data = await validJson()
    delete (data.tables as Record<string, unknown>).payments
    expectRejected(data, /missing the payments table/)
  })

  test('wrong field type', async () => {
    const data = await validJson()
    ;(data.tables as { products: Record<string, unknown>[] }).products[0].price = '75'
    expectRejected(data, /products row 1: "price"/)
  })

  test('broken reference', async () => {
    const data = await validJson()
    ;(data.tables as { saleItems: Record<string, unknown>[] }).saleItems[0].productId = 'gone'
    expectRejected(data, /missing sale or product/)
  })

  test('stock that does not match its history', async () => {
    const data = await validJson()
    ;(data.tables as { products: Record<string, unknown>[] }).products[0].stock = 999
    expectRejected(data, /does not match its history/)
  })

  test('duplicate ids', async () => {
    const data = await validJson()
    const products = (data.tables as { products: Record<string, unknown>[] }).products
    products.push({ ...products[0] })
    expectRejected(data, /products has two rows with the same id/)
  })

  test('unknown payment type', async () => {
    const data = await validJson()
    ;(data.tables as { sales: Record<string, unknown>[] }).sales[0].payment = 'card'
    expectRejected(data, /unknown payment type/)
  })

  test('sale pointing to a missing customer', async () => {
    const data = await validJson()
    ;(data.tables as { sales: Record<string, unknown>[] }).sales[0].customerId = 'gone'
    expectRejected(data, /Sale .* points to a missing customer/)
  })

  test('unknown stock reason', async () => {
    const data = await validJson()
    ;(data.tables as { stockMoves: Record<string, unknown>[] }).stockMoves[0].reason = 'magic'
    expectRejected(data, /unknown reason/)
  })

  test('stock move pointing to a missing product', async () => {
    const data = await validJson()
    ;(data.tables as { stockMoves: Record<string, unknown>[] }).stockMoves[0].productId = 'gone'
    expectRejected(data, /missing product or sale/)
  })

  test('payment pointing to a missing customer', async () => {
    const data = await validJson()
    ;(data.tables as { payments: Record<string, unknown>[] }).payments[0].customerId = 'gone'
    expectRejected(data, /Payment .* points to a missing customer/)
  })

  test('row that is not an object', async () => {
    const data = await validJson()
    ;(data.tables as { products: unknown[] }).products = [42]
    expectRejected(data, /products row 1: "row"/)
  })

  test('missing tables object', async () => {
    const data = await validJson()
    delete data.tables
    expectRejected(data, /incomplete/)
  })

  test('a rejected file leaves current data untouched', async () => {
    const db = freshDb()
    await seed(db)
    const before = await exportBackup(db, NOW)
    const data = await validJson()
    ;(data.tables as { products: Record<string, unknown>[] }).products[0].stock = 999

    const result = parseBackup(JSON.stringify(data))
    if (result.ok) await restoreBackup(db, result.backup)

    expect(result.ok).toBe(false)
    expect(await exportBackup(db, NOW)).toEqual(before)
  })
})

describe('restoreBackup', () => {
  test('a failed restore leaves current data untouched', async () => {
    const db = freshDb()
    await seed(db)
    const before = await exportBackup(db, NOW)
    const broken = structuredClone(before)
    broken.tables.products.push({ ...broken.tables.products[0] })

    await expect(restoreBackup(db, broken)).rejects.toThrow()

    expect(await exportBackup(db, NOW)).toEqual(before)
  })
})

describe('backup date', () => {
  test('remembers when the last backup was made', async () => {
    const db = freshDb()
    expect(await lastBackupAt(db)).toBeNull()
    await markBackedUp(db, NOW)
    expect(await lastBackupAt(db)).toBe('2026-10-12T09:30:00.000Z')
  })

  test('file name uses local date and time', () => {
    expect(backupFileName(NOW)).toBe('bebie-store-backup-2026-10-12-1730.json')
  })
})
