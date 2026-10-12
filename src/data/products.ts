import { newId, nowIso, type Product, type StoreDb } from '../db'
import { parseCount, parsePesos, type Centavos } from '../money'
import { ValidationError, isWholeNumber, type FieldErrors } from '../validation'
import { moveStock } from './stock'

export interface ProductInput {
  name: string
  price: Centavos
  cost: Centavos | null
  lowStockAt: number | null
  packSize: number | null
  favorite: boolean
}

export interface NewProductInput extends ProductInput {
  startingStock: number
}

/** Raw text from the product form, exactly as typed. */
export interface ProductForm {
  name: string
  price: string
  cost: string
  startingStock: string
  lowStockAt: string
  packSize: string
  favorite: boolean
}

export const EMPTY_PRODUCT_FORM: ProductForm = {
  name: '',
  price: '',
  cost: '',
  startingStock: '',
  lowStockAt: '',
  packSize: '',
  favorite: false,
}

export type ParsedProductForm =
  { ok: true; input: NewProductInput } | { ok: false; errors: FieldErrors }

export function parseProductForm(form: ProductForm): ParsedProductForm {
  const errors: FieldErrors = {}
  const name = form.name.trim()
  if (name === '') errors.name = 'Name is required'
  const price = parsePesos(form.price)
  if (price === null) errors.price = 'Enter a price like 12 or 12.50'
  const cost = parseOptional(form.cost, parsePesos)
  if (cost === undefined) errors.cost = 'Enter a cost like 10 or 10.50'
  const startingStock = parseOptional(form.startingStock, parseCount)
  if (startingStock === undefined) errors.startingStock = 'Enter a whole number'
  const lowStockAt = parseOptional(form.lowStockAt, parseCount)
  if (lowStockAt === undefined) errors.lowStockAt = 'Enter a whole number'
  const packSize = parseOptional(form.packSize, parseCount)
  if (packSize === undefined || (packSize !== null && packSize < 2)) {
    errors.packSize = 'Pack size must be a whole number of 2 or more'
  }

  if (
    Object.keys(errors).length > 0 ||
    price === null ||
    cost === undefined ||
    startingStock === undefined ||
    lowStockAt === undefined ||
    packSize === undefined
  ) {
    return { ok: false, errors }
  }
  return {
    ok: true,
    input: {
      name,
      price,
      cost,
      startingStock: startingStock ?? 0,
      lowStockAt,
      packSize,
      favorite: form.favorite,
    },
  }
}

/** Blank text means "not set" (null). Text that fails to parse means invalid (undefined). */
function parseOptional<T>(text: string, parse: (text: string) => T | null): T | null | undefined {
  if (text.trim() === '') return null
  return parse(text) ?? undefined
}

function assertValidProduct(input: ProductInput): void {
  const errors: FieldErrors = {}
  if (input.name.trim() === '') errors.name = 'Name is required'
  if (!isWholeNumber(input.price)) errors.price = 'Price must be zero or more'
  if (input.cost !== null && !isWholeNumber(input.cost)) errors.cost = 'Cost must be zero or more'
  if (input.lowStockAt !== null && !isWholeNumber(input.lowStockAt)) {
    errors.lowStockAt = 'Low stock level must be a whole number'
  }
  if (input.packSize !== null && !isWholeNumber(input.packSize, 2)) {
    errors.packSize = 'Pack size must be a whole number of 2 or more'
  }
  if (Object.keys(errors).length > 0) throw new ValidationError(errors)
}

export async function addProduct(
  db: StoreDb,
  input: NewProductInput,
  reason: 'initial' | 'import' = 'initial',
): Promise<Product> {
  assertValidProduct(input)
  if (!isWholeNumber(input.startingStock)) {
    throw new ValidationError({ startingStock: 'Starting stock must be a whole number' })
  }
  const at = nowIso()
  const id = newId()
  return db.transaction('rw', db.products, db.stockMoves, async () => {
    await db.products.add({
      id,
      name: input.name.trim(),
      price: input.price,
      cost: input.cost,
      stock: 0,
      lowStockAt: input.lowStockAt,
      packSize: input.packSize,
      favorite: input.favorite,
      active: true,
      createdAt: at,
      updatedAt: at,
    })
    if (input.startingStock > 0) await moveStock(db, id, input.startingStock, reason)
    const saved = await db.products.get(id)
    if (!saved) throw new Error(`Product disappeared while saving: ${id}`)
    return saved
  })
}

export async function updateProduct(db: StoreDb, id: string, input: ProductInput): Promise<void> {
  assertValidProduct(input)
  const updated = await db.products.update(id, {
    name: input.name.trim(),
    price: input.price,
    cost: input.cost,
    lowStockAt: input.lowStockAt,
    packSize: input.packSize,
    favorite: input.favorite,
    updatedAt: nowIso(),
  })
  if (updated === 0) throw new Error(`Product not found: ${id}`)
}

export async function setProductActive(db: StoreDb, id: string, active: boolean): Promise<void> {
  const updated = await db.products.update(id, { active, updatedAt: nowIso() })
  if (updated === 0) throw new Error(`Product not found: ${id}`)
}

export function matchesSearch(name: string, typed: string): boolean {
  const haystack = name.toLowerCase()
  return typed
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => haystack.includes(word))
}

export function findSimilar(products: Product[], typed: string, limit = 3): Product[] {
  if (typed.trim().length < 3) return []
  return products.filter((product) => matchesSearch(product.name, typed)).slice(0, limit)
}

export function isLowStock(product: Product): boolean {
  return product.stock <= 0 || (product.lowStockAt !== null && product.stock <= product.lowStockAt)
}
