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

const SWIPES_KEY = 'cartSwipes'

/** How many times the cart bar was swiped; the swipe hint hides after a few. */
export async function loadCartSwipes(db: StoreDb): Promise<number> {
  const row = await db.settings.get(SWIPES_KEY)
  return Number(row?.value) || 0
}

export async function addCartSwipe(db: StoreDb): Promise<void> {
  // In a transaction so quick swipes in a row each count.
  await db.transaction('rw', db.settings, async () => {
    await db.settings.put({ key: SWIPES_KEY, value: String((await loadCartSwipes(db)) + 1) })
  })
}
