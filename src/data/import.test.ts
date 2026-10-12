import { describe, expect, test } from 'vitest'
import { expectStockMatchesMoves, freshDb } from '../test/helpers'
import { importProducts, previewProductsCsv } from './import'

const CSV = `name,price,cost,stock,lowStockAt,packSize,favorite
Coke 1.5L,75,62,14,4,,yes
Marlboro Red,9,8.25,46,20,20,Yes
Ice,5,,,,,
`

describe('previewProductsCsv', () => {
  test('accepts friendly header spellings', () => {
    const preview = previewProductsCsv(
      'Name,Price,Stock,Pack size,Low stock at,Favorite\nMami,9,5,20,2,yes',
      [],
    )
    expect(preview.errors).toEqual([])
    expect(preview.rows[0]).toMatchObject({
      startingStock: 5,
      packSize: 20,
      lowStockAt: 2,
      favorite: true,
    })
  })

  test('shows an error for an unknown column but still imports the rows', () => {
    const preview = previewProductsCsv('name,price,Colour\nMami,9,red', [])
    expect(preview.errors).toEqual([{ line: 1, message: 'Unknown column: Colour' }])
    expect(preview.rows).toHaveLength(1)
  })

  test('shows Papa Parse errors such as a broken quote', () => {
    const preview = previewProductsCsv('name,price\n"Mami,9\nIce,5', [])
    expect(preview.errors.length).toBeGreaterThan(0)
  })

  test('reads valid rows in pesos and converts them', () => {
    const preview = previewProductsCsv(CSV, [])
    expect(preview.errors).toEqual([])
    expect(preview.rows).toEqual([
      {
        name: 'Coke 1.5L',
        price: 7500,
        cost: 6200,
        startingStock: 14,
        lowStockAt: 4,
        packSize: null,
        favorite: true,
      },
      {
        name: 'Marlboro Red',
        price: 900,
        cost: 825,
        startingStock: 46,
        lowStockAt: 20,
        packSize: 20,
        favorite: true,
      },
      {
        name: 'Ice',
        price: 500,
        cost: null,
        startingStock: 0,
        lowStockAt: null,
        packSize: null,
        favorite: false,
      },
    ])
  })

  test('only name and price columns are required', () => {
    const preview = previewProductsCsv('name,price\nEgg,9\n', [])
    expect(preview.rows).toHaveLength(1)
  })

  test('reports a missing required column', () => {
    const preview = previewProductsCsv('name,cost\nEgg,8\n', [])
    expect(preview.rows).toEqual([])
    expect(preview.errors).toEqual([{ line: 1, message: 'Missing column: price' }])
  })

  test('reports invalid rows with their line number', () => {
    const preview = previewProductsCsv('name,price\nEgg,nine\n,5\nRice,52\n', [])
    expect(preview.rows.map((r) => r.name)).toEqual(['Rice'])
    expect(preview.errors.map((e) => e.line)).toEqual([2, 3])
  })

  test('skips names that already exist or repeat in the file, ignoring case', () => {
    const preview = previewProductsCsv('name,price\ncoke 1.5l,75\nEgg,9\negg,9\n', ['Coke 1.5L'])
    expect(preview.rows.map((r) => r.name)).toEqual(['Egg'])
    expect(preview.duplicates).toEqual([
      { line: 2, name: 'coke 1.5l' },
      { line: 4, name: 'egg' },
    ])
  })
})

describe('importProducts', () => {
  test('adds every row with an import stock move', async () => {
    const db = freshDb()
    const count = await importProducts(db, previewProductsCsv(CSV, []).rows)

    expect(count).toBe(3)
    expect(await db.products.count()).toBe(3)
    expect((await db.stockMoves.toArray()).map((m) => m.reason)).toEqual(['import', 'import'])
    await expectStockMatchesMoves(db)
  })
})
