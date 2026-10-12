import type { StoreDb } from '../db'
import type { SortMode } from '../domain/product-sort'

const KEY = 'allProductsSort'

export async function loadAllProductsSort(db: StoreDb): Promise<SortMode> {
  const row = await db.settings.get(KEY)
  return row?.value === 'best' ? 'best' : 'az'
}

export async function saveAllProductsSort(db: StoreDb, mode: SortMode): Promise<void> {
  await db.settings.put({ key: KEY, value: mode })
}
