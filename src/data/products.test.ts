import { describe, expect, test } from 'vitest'
import { expectStockMatchesMoves, freshDb, sampleProduct } from '../test/helpers'
import { ValidationError } from '../validation'
import {
  EMPTY_PRODUCT_FORM,
  addProduct,
  findSimilar,
  isLowStock,
  matchesSearch,
  parseProductForm,
  setProductActive,
  updateProduct,
} from './products'

describe('parseProductForm', () => {
  test('converts text fields to numbers and centavos', () => {
    const result = parseProductForm({
      name: '  Marlboro Red ',
      price: '9',
      cost: '8.25',
      startingStock: '46',
      lowStockAt: '20',
      packSize: '20',
      favorite: true,
    })
    expect(result).toEqual({
      ok: true,
      input: {
        name: 'Marlboro Red',
        price: 900,
        cost: 825,
        startingStock: 46,
        lowStockAt: 20,
        packSize: 20,
        favorite: true,
      },
    })
  })

  test('treats blank optional fields as not set and blank stock as 0', () => {
    const result = parseProductForm({ ...EMPTY_PRODUCT_FORM, name: 'Ice', price: '5', cost: '3' })
    expect(result).toEqual({
      ok: true,
      input: {
        name: 'Ice',
        price: 500,
        cost: 300,
        startingStock: 0,
        lowStockAt: null,
        packSize: null,
        favorite: false,
      },
    })
  })

  test('rejects a blank cost but allows a cost of 0', () => {
    const base = { ...EMPTY_PRODUCT_FORM, name: 'Ice', price: '5' }
    expect(parseProductForm({ ...base, cost: ' ' })).toEqual({
      ok: false,
      errors: { cost: 'Cost is required' },
    })
    expect(parseProductForm({ ...base, cost: '0' })).toMatchObject({ ok: true, input: { cost: 0 } })
  })

  test('reports every invalid field', () => {
    const result = parseProductForm({
      name: ' ',
      price: 'abc',
      cost: '-1',
      startingStock: '2.5',
      lowStockAt: 'x',
      packSize: '1',
      favorite: false,
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(Object.keys(result.errors).sort()).toEqual(
      ['cost', 'lowStockAt', 'name', 'packSize', 'price', 'startingStock'].sort(),
    )
  })
})

describe('addProduct', () => {
  test('saves the product with its starting stock as an initial stock move', async () => {
    const db = freshDb()
    const product = await addProduct(db, sampleProduct({ startingStock: 24 }))

    expect(product).toMatchObject({ name: 'Coke 1.5L', stock: 24, active: true })
    const moves = await db.stockMoves.toArray()
    expect(moves).toMatchObject([{ productId: product.id, change: 24, reason: 'initial' }])
    await expectStockMatchesMoves(db)
  })

  test('writes no stock move when starting stock is 0', async () => {
    const db = freshDb()
    const product = await addProduct(db, sampleProduct({ startingStock: 0 }))
    expect(product.stock).toBe(0)
    expect(await db.stockMoves.count()).toBe(0)
  })

  test('rejects invalid input and saves nothing', async () => {
    const db = freshDb()
    await expect(addProduct(db, sampleProduct({ price: -1 }))).rejects.toBeInstanceOf(
      ValidationError,
    )
    expect(await db.products.count()).toBe(0)
  })
})

describe('updateProduct', () => {
  test('changes the editable fields but not stock', async () => {
    const db = freshDb()
    const product = await addProduct(db, sampleProduct())
    await updateProduct(db, product.id, {
      name: 'Coke 1.5 Liter',
      price: 8000,
      cost: 6600,
      lowStockAt: 4,
      packSize: null,
      favorite: true,
    })
    expect(await db.products.get(product.id)).toMatchObject({
      name: 'Coke 1.5 Liter',
      price: 8000,
      cost: 6600,
      lowStockAt: 4,
      favorite: true,
      stock: 10,
    })
  })

  test('throws for an unknown product', async () => {
    const db = freshDb()
    // A NewProductInput is also a valid ProductInput; startingStock is ignored.
    await expect(updateProduct(db, 'missing', sampleProduct())).rejects.toThrow('Product not found')
  })
})

describe('setProductActive', () => {
  test('stops and resumes selling', async () => {
    const db = freshDb()
    const product = await addProduct(db, sampleProduct())
    await setProductActive(db, product.id, false)
    expect((await db.products.get(product.id))?.active).toBe(false)
    await setProductActive(db, product.id, true)
    expect((await db.products.get(product.id))?.active).toBe(true)
  })
})

describe('search', () => {
  test('matches when every typed word appears in the name, ignoring case', () => {
    expect(matchesSearch('Lucky Me Beef Mami', 'beef luck')).toBe(true)
    expect(matchesSearch('Lucky Me Beef Mami', 'chicken')).toBe(false)
    expect(matchesSearch('Lucky Me Beef Mami', '   ')).toBe(true)
  })

  test('findSimilar needs at least 3 typed characters and returns up to 3', async () => {
    const db = freshDb()
    for (const name of [
      'Lucky Me Beef Mami',
      'Lucky Me Beef na Beef',
      'Lucky Me Beef Big',
      'Lucky Me Beef Cup',
    ]) {
      await addProduct(db, sampleProduct({ name }))
    }
    const products = await db.products.toArray()
    expect(findSimilar(products, 'Lu')).toEqual([])
    expect(findSimilar(products, 'lucky beef')).toHaveLength(3)
  })
})

describe('isLowStock', () => {
  test('is true at or below the alert level, or when out of stock', async () => {
    const db = freshDb()
    const product = await addProduct(db, sampleProduct({ lowStockAt: 5, startingStock: 5 }))
    expect(isLowStock(product)).toBe(true)
    expect(isLowStock({ ...product, stock: 6 })).toBe(false)
    expect(isLowStock({ ...product, lowStockAt: null, stock: -1 })).toBe(true)
    expect(isLowStock({ ...product, lowStockAt: null, stock: 0 })).toBe(true)
    expect(isLowStock({ ...product, lowStockAt: null, stock: 1 })).toBe(false)
  })
})
