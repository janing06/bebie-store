import Papa from 'papaparse'
import type { StoreDb } from '../db'
import { addProduct, parseProductForm, type NewProductInput } from './products'

export interface ImportPreview {
  rows: NewProductInput[]
  errors: { line: number; message: string }[]
  duplicates: { line: number; name: string }[]
}

const REQUIRED_COLUMNS = ['name', 'price', 'cost']
const KNOWN_COLUMNS: Record<string, string> = {
  name: 'name',
  price: 'price',
  cost: 'cost',
  stock: 'stock',
  lowstockat: 'lowStockAt',
  packsize: 'packSize',
  favorite: 'favorite',
}

function isYes(value: string | undefined): boolean {
  return /^(y|yes|true|1)$/i.test((value ?? '').trim())
}

/** Line numbers match the spreadsheet: the header is line 1. */
export function previewProductsCsv(text: string, existingNames: string[]): ImportPreview {
  const unknownHeaders: string[] = []
  const parsed = Papa.parse<Record<string, string | undefined>>(text.trim(), {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: (header) => {
      const known = KNOWN_COLUMNS[header.toLowerCase().replace(/[\s_-]/g, '')]
      if (known) return known
      if (header.trim() !== '') unknownHeaders.push(header.trim())
      return header.trim()
    },
  })
  const preview: ImportPreview = { rows: [], errors: [], duplicates: [] }
  for (const header of unknownHeaders) {
    preview.errors.push({ line: 1, message: `Unknown column: ${header}` })
  }
  for (const error of parsed.errors) {
    preview.errors.push({ line: (error.row ?? 0) + 2, message: error.message })
  }
  const missing = REQUIRED_COLUMNS.filter((column) => !parsed.meta.fields?.includes(column))
  if (missing.length > 0) {
    preview.errors.push({ line: 1, message: `Missing column: ${missing.join(', ')}` })
    return preview
  }

  const seen = new Set(existingNames.map((name) => name.trim().toLowerCase()))
  parsed.data.forEach((record, index) => {
    const line = index + 2
    const result = parseProductForm({
      name: record.name ?? '',
      price: record.price ?? '',
      cost: record.cost ?? '',
      startingStock: record.stock ?? '',
      lowStockAt: record.lowStockAt ?? '',
      packSize: record.packSize ?? '',
      favorite: isYes(record.favorite),
    })
    if (!result.ok) {
      preview.errors.push({ line, message: Object.values(result.errors).join('; ') })
      return
    }
    const key = result.input.name.toLowerCase()
    if (seen.has(key)) {
      preview.duplicates.push({ line, name: result.input.name })
      return
    }
    seen.add(key)
    preview.rows.push(result.input)
  })
  return preview
}

/** Adds all rows in one transaction: either every product is imported or none. */
export async function importProducts(db: StoreDb, rows: NewProductInput[]): Promise<number> {
  await db.transaction('rw', db.products, db.stockMoves, async () => {
    for (const row of rows) await addProduct(db, row, 'import')
  })
  return rows.length
}
