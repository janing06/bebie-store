import { afterEach, expect, test, vi } from 'vitest'
import type { Product } from '../db'
import { freshDb, sampleProduct } from '../test/helpers'
import { exportBackup, parseBackup, restoreBackup } from './backup'
import { loadFavoriteOrder, moveId, orderFavorites, saveFavoriteOrder } from './favorites'
import { addProduct } from './products'

afterEach(() => vi.restoreAllMocks())

function product(id: string, overrides: Partial<Product> = {}): Product {
  return { id, name: id, favorite: true, active: true, ...overrides } as Product
}

const ids = (products: Product[]) => products.map((p) => p.id)

test('orderFavorites keeps the saved order', () => {
  const products = [product('a'), product('b'), product('c')]
  expect(ids(orderFavorites(products, ['c', 'a', 'b']))).toEqual(['c', 'a', 'b'])
})

test('orderFavorites appends new favorites alphabetically', () => {
  const products = [product('z', { name: 'Zebra' }), product('a', { name: 'Apple' }), product('m')]
  expect(ids(orderFavorites(products, ['m']))).toEqual(['m', 'a', 'z'])
})

test('orderFavorites ignores unknown, inactive and non-favorite ids', () => {
  const products = [
    product('a'),
    product('b', { active: false }),
    product('c', { favorite: false }),
  ]
  expect(ids(orderFavorites(products, ['x', 'b', 'c', 'a']))).toEqual(['a'])
})

test('moveId moves an id to the position of another', () => {
  expect(moveId(['a', 'b', 'c'], 'a', 'c')).toEqual(['b', 'c', 'a'])
})

test('moveId leaves the order alone for unknown ids', () => {
  expect(moveId(['a', 'b'], 'a', 'x')).toEqual(['a', 'b'])
})

test('saves and loads the order', async () => {
  const db = freshDb()
  await saveFavoriteOrder(db, ['b', 'a'])
  expect(await loadFavoriteOrder(db)).toEqual(['b', 'a'])
})

test('loads an empty order when nothing was saved', async () => {
  expect(await loadFavoriteOrder(freshDb())).toEqual([])
})

test('loads an empty order for invalid JSON and logs once', async () => {
  const error = vi.spyOn(console, 'error').mockImplementation(() => {})
  const db = freshDb()
  await db.settings.put({ key: 'favoriteOrder', value: '{nope' })
  expect(await loadFavoriteOrder(db)).toEqual([])
  expect(error).toHaveBeenCalledOnce()
})

test('the order survives a backup and restore', async () => {
  const db = freshDb()
  const coke = await addProduct(db, sampleProduct({ favorite: true }))
  await saveFavoriteOrder(db, [coke.id])
  const parsed = parseBackup(JSON.stringify(await exportBackup(db)))
  if (!parsed.ok) throw new Error(parsed.error)

  const other = freshDb()
  await restoreBackup(other, parsed.backup)
  expect(await loadFavoriteOrder(other)).toEqual([coke.id])
})
