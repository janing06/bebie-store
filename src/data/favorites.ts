import { arrayMove } from '@dnd-kit/sortable'
import type { Product, StoreDb } from '../db'

const KEY = 'favoriteOrder'

export function orderFavorites(products: Product[], order: string[]): Product[] {
  const favorites = products.filter((product) => product.active && product.favorite)
  const byId = new Map(favorites.map((product) => [product.id, product]))
  const ordered = order.flatMap((id) => byId.get(id) ?? [])
  const rest = favorites
    .filter((product) => !order.includes(product.id))
    .sort((a, b) => a.name.localeCompare(b.name))
  return [...ordered, ...rest]
}

export function moveId(ids: string[], fromId: string, toId: string): string[] {
  const from = ids.indexOf(fromId)
  const to = ids.indexOf(toId)
  return from < 0 || to < 0 ? ids : arrayMove(ids, from, to)
}

export async function loadFavoriteOrder(db: StoreDb): Promise<string[]> {
  const row = await db.settings.get(KEY)
  if (!row) return []
  try {
    const order: unknown = JSON.parse(row.value)
    return Array.isArray(order) ? order.filter((id) => typeof id === 'string') : []
  } catch (error) {
    console.error('Could not read favorite order', error)
    return []
  }
}

export async function saveFavoriteOrder(db: StoreDb, ids: string[]): Promise<void> {
  await db.settings.put({ key: KEY, value: JSON.stringify(ids) })
}
