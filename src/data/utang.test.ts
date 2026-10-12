import { describe, expect, test } from 'vitest'
import type { Sale, UtangPayment } from '../db'
import { addToCart } from '../domain/cart'
import { freshDb, sampleProduct } from '../test/helpers'
import { ValidationError } from '../validation'
import { addProduct } from './products'
import { checkout, voidSale } from './sales'
import {
  addCustomer,
  balanceOf,
  customerLedger,
  oldestUnpaidAt,
  recordPayment,
  utangRows,
} from './utang'

function sale(overrides: Partial<Sale>): Sale {
  return {
    id: crypto.randomUUID(),
    createdAt: '2026-10-01T02:00:00.000Z',
    payment: 'utang',
    customerId: 'nena',
    total: 10000,
    cashReceived: null,
    voidedAt: null,
    ...overrides,
  }
}

function payment(amount: number): UtangPayment {
  return {
    id: crypto.randomUUID(),
    customerId: 'nena',
    amount,
    createdAt: '2026-10-05T02:00:00.000Z',
  }
}

async function setupCredit(total: number) {
  const db = freshDb()
  const product = await addProduct(db, sampleProduct({ price: total, startingStock: 100 }))
  const customer = await addCustomer(db, 'Aling Nena', 'near the chapel')
  const credit = await checkout(db, {
    cart: addToCart([], product, 1),
    payment: 'utang',
    customerId: customer.id,
  })
  return { db, customer, credit }
}

describe('addCustomer', () => {
  test('trims the name and stores a blank note as null', async () => {
    const db = freshDb()
    const customer = await addCustomer(db, '  Bebang ', '  ')
    expect(customer).toMatchObject({ name: 'Bebang', note: null, active: true })
  })

  test('requires a name', async () => {
    const db = freshDb()
    await expect(addCustomer(db, ' ', '')).rejects.toBeInstanceOf(ValidationError)
  })
})

describe('balanceOf', () => {
  test('is unvoided utang sales minus payments', () => {
    const sales = [
      sale({ total: 10000 }),
      sale({ total: 5000, voidedAt: '2026-10-01T03:00:00.000Z' }),
      sale({ total: 3000, payment: 'cash' }),
    ]
    expect(balanceOf(sales, [payment(4000)])).toBe(6000)
  })
})

describe('oldestUnpaidAt', () => {
  test('payments cover the oldest credit first', () => {
    const sales = [
      sale({ createdAt: '2026-10-01T02:00:00.000Z', total: 10000 }),
      sale({ createdAt: '2026-10-03T02:00:00.000Z', total: 5000 }),
    ]
    expect(oldestUnpaidAt(sales, [])).toBe('2026-10-01T02:00:00.000Z')
    expect(oldestUnpaidAt(sales, [payment(10000)])).toBe('2026-10-03T02:00:00.000Z')
    expect(oldestUnpaidAt(sales, [payment(15000)])).toBeNull()
  })
})

describe('recordPayment', () => {
  test('accepts a partial payment', async () => {
    const { db, customer } = await setupCredit(45000)
    await recordPayment(db, customer.id, 20000)
    const { sales, payments } = await customerLedger(db, customer.id)
    expect(balanceOf(sales, payments)).toBe(25000)
  })

  test('rejects more than the balance', async () => {
    const { db, customer } = await setupCredit(45000)
    await expect(recordPayment(db, customer.id, 45001)).rejects.toBeInstanceOf(ValidationError)
    expect(await db.payments.count()).toBe(0)
  })

  test('rejects zero', async () => {
    const { db, customer } = await setupCredit(45000)
    await expect(recordPayment(db, customer.id, 0)).rejects.toBeInstanceOf(ValidationError)
  })

  test('rejects an unknown customer', async () => {
    const db = freshDb()
    await expect(recordPayment(db, 'missing', 100)).rejects.toThrow('Customer not found')
  })
})

describe('voiding a credit sale after a partial payment', () => {
  test('leaves a negative (overpaid) balance', async () => {
    const { db, customer, credit } = await setupCredit(10000)
    await recordPayment(db, customer.id, 6000)
    await voidSale(db, credit.id)

    const [row] = await utangRows(db)
    expect(row.balance).toBe(-6000)
    expect(row.oldestUnpaidAt).toBeNull()
  })
})

describe('utangRows', () => {
  test('lists the oldest unpaid customers first, then everyone else by name', async () => {
    const db = freshDb()
    const product = await addProduct(db, sampleProduct({ price: 1000, startingStock: 100 }))
    const zed = await addCustomer(db, 'Zed', '')
    const amy = await addCustomer(db, 'Amy', '')
    await addCustomer(db, 'Ben', '')
    const older = await checkout(db, {
      cart: addToCart([], product, 1),
      payment: 'utang',
      customerId: zed.id,
    })
    await checkout(db, { cart: addToCart([], product, 2), payment: 'utang', customerId: amy.id })
    await db.sales.update(older.id, { createdAt: '2026-09-01T02:00:00.000Z' })

    const rows = await utangRows(db)
    expect(rows.map((r) => [r.customer.name, r.balance])).toEqual([
      ['Zed', 1000],
      ['Amy', 2000],
      ['Ben', 0],
    ])
  })
})
