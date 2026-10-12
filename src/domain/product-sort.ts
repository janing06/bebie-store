import type { Product, Sale, SaleItem } from '../db'

export type SortMode = 'az' | 'best'

/** Pieces sold per product id, ignoring voided sales. */
export function soldQuantities(sales: Sale[], items: SaleItem[]): Map<string, number> {
  const unvoided = new Set(sales.filter((sale) => sale.voidedAt === null).map((sale) => sale.id))
  const sold = new Map<string, number>()
  for (const item of items) {
    if (unvoided.has(item.saleId)) {
      sold.set(item.productId, (sold.get(item.productId) ?? 0) + item.qty)
    }
  }
  return sold
}

export function sortProducts(
  products: Product[],
  mode: SortMode,
  sold: Map<string, number>,
): Product[] {
  const byName = (a: Product, b: Product) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
  const soldOf = (product: Product) => (mode === 'best' ? (sold.get(product.id) ?? 0) : 0)
  return [...products].sort((a, b) => soldOf(b) - soldOf(a) || byName(a, b))
}
