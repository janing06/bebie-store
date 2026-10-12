import Dexie, { type EntityTable } from 'dexie'
import type { Centavos } from './money'

export interface Product {
  id: string
  name: string
  price: Centavos // per piece
  cost: Centavos | null // per piece
  stock: number // pieces; may go negative
  lowStockAt: number | null
  packSize: number | null
  favorite: boolean
  active: boolean // false = stopped selling
  createdAt: string
  updatedAt: string
}

export type PaymentMethod = 'cash' | 'utang'

export interface Sale {
  id: string
  createdAt: string
  payment: PaymentMethod
  customerId: string | null // utang only
  total: Centavos
  cashReceived: Centavos | null // cash only
  voidedAt: string | null
}

export interface SaleItem {
  id: string
  saleId: string
  productId: string
  name: string // copied at time of sale
  qty: number // pieces
  price: Centavos // copied at time of sale
  cost: Centavos | null // copied at time of sale
}

export const ADJUST_REASONS = ['spoiled', 'missing', 'recount', 'family'] as const
export type AdjustReason = (typeof ADJUST_REASONS)[number]

export const STOCK_REASONS = [
  'initial',
  'sale',
  'void',
  'restock',
  'import',
  ...ADJUST_REASONS,
] as const
export type StockReason = (typeof STOCK_REASONS)[number]

export interface StockMove {
  id: string
  productId: string
  change: number // never 0
  reason: StockReason
  saleId: string | null
  note: string | null
  createdAt: string
}

export interface Customer {
  id: string
  name: string
  note: string | null
  active: boolean
  createdAt: string
}

export interface UtangPayment {
  id: string
  customerId: string
  amount: Centavos
  createdAt: string
}

export interface Setting {
  key: string
  value: string
}

export class StoreDb extends Dexie {
  products!: EntityTable<Product, 'id'>
  sales!: EntityTable<Sale, 'id'>
  saleItems!: EntityTable<SaleItem, 'id'>
  stockMoves!: EntityTable<StockMove, 'id'>
  customers!: EntityTable<Customer, 'id'>
  payments!: EntityTable<UtangPayment, 'id'>
  settings!: EntityTable<Setting, 'key'>

  constructor(name = 'bebie-store') {
    super(name)
    // Only fields we query by are indexed. Booleans cannot be indexed in IndexedDB.
    this.version(1).stores({
      products: 'id, name',
      sales: 'id, createdAt, customerId',
      saleItems: 'id, saleId, productId',
      stockMoves: 'id, productId, saleId',
      customers: 'id, name',
      payments: 'id, customerId',
      settings: 'key',
    })
  }
}

export const db = new StoreDb()

export function newId(): string {
  return crypto.randomUUID()
}

export function nowIso(): string {
  return new Date().toISOString()
}
