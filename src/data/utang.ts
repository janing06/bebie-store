import { newId, nowIso, type Customer, type Sale, type StoreDb, type UtangPayment } from '../db'
import { formatPesos, type Centavos } from '../money'
import { ValidationError, isWholeNumber } from '../validation'

export async function addCustomer(db: StoreDb, name: string, note: string): Promise<Customer> {
  const trimmed = name.trim()
  if (trimmed === '') throw new ValidationError({ name: 'Name is required' })
  const customer: Customer = {
    id: newId(),
    name: trimmed,
    note: note.trim() === '' ? null : note.trim(),
    active: true,
    createdAt: nowIso(),
  }
  await db.customers.add(customer)
  return customer
}

function unvoidedCredit(sales: Sale[]): Sale[] {
  return sales.filter((sale) => sale.payment === 'utang' && sale.voidedAt === null)
}

/** Negative means the customer has paid more than they owe (for example after a void). */
export function balanceOf(sales: Sale[], payments: UtangPayment[]): Centavos {
  const owed = unvoidedCredit(sales).reduce((total, sale) => total + sale.total, 0)
  const paid = payments.reduce((total, payment) => total + payment.amount, 0)
  return owed - paid
}

/** The date of the oldest credit sale not yet covered, with payments covering the oldest first. */
export function oldestUnpaidAt(sales: Sale[], payments: UtangPayment[]): string | null {
  let paid = payments.reduce((total, payment) => total + payment.amount, 0)
  const credit = unvoidedCredit(sales).sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  for (const sale of credit) {
    if (paid < sale.total) return sale.createdAt
    paid -= sale.total
  }
  return null
}

export async function customerLedger(
  db: StoreDb,
  customerId: string,
): Promise<{ sales: Sale[]; payments: UtangPayment[] }> {
  const [sales, payments] = await Promise.all([
    db.sales.where('customerId').equals(customerId).toArray(),
    db.payments.where('customerId').equals(customerId).toArray(),
  ])
  return { sales, payments }
}

export async function recordPayment(
  db: StoreDb,
  customerId: string,
  amount: Centavos,
): Promise<UtangPayment> {
  if (!isWholeNumber(amount, 1))
    throw new ValidationError({ amount: 'Enter an amount more than ₱0' })
  return db.transaction('rw', [db.customers, db.sales, db.payments], async () => {
    if (!(await db.customers.get(customerId))) throw new Error(`Customer not found: ${customerId}`)
    const { sales, payments } = await customerLedger(db, customerId)
    const balance = balanceOf(sales, payments)
    if (amount > balance) {
      throw new ValidationError({
        amount: `Amount is more than the balance of ${formatPesos(balance)}`,
      })
    }
    const payment: UtangPayment = { id: newId(), customerId, amount, createdAt: nowIso() }
    await db.payments.add(payment)
    return payment
  })
}

export interface UtangRow {
  customer: Customer
  balance: Centavos
  oldestUnpaidAt: string | null
}

export async function utangRows(db: StoreDb): Promise<UtangRow[]> {
  const [customers, sales, payments] = await Promise.all([
    db.customers.toArray(),
    // Cash sales have customerId null, which IndexedDB leaves out of the index.
    db.sales.orderBy('customerId').toArray(),
    db.payments.toArray(),
  ])
  return customers
    .filter((customer) => customer.active)
    .map((customer) => {
      const own = sales.filter((sale) => sale.customerId === customer.id)
      const paid = payments.filter((payment) => payment.customerId === customer.id)
      return { customer, balance: balanceOf(own, paid), oldestUnpaidAt: oldestUnpaidAt(own, paid) }
    })
    .sort(compareRows)
}

function compareRows(a: UtangRow, b: UtangRow): number {
  if (a.oldestUnpaidAt && b.oldestUnpaidAt) return a.oldestUnpaidAt.localeCompare(b.oldestUnpaidAt)
  if (a.oldestUnpaidAt) return -1
  if (b.oldestUnpaidAt) return 1
  return a.customer.name.localeCompare(b.customer.name)
}
