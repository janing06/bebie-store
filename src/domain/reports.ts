import type { Sale, SaleItem } from '../db'
import type { Centavos } from '../money'

export interface BestSeller {
  productId: string
  name: string
  qty: number
  total: Centavos
}

export interface Summary {
  salesTotal: Centavos
  salesCount: number
  cash: Centavos
  utang: Centavos
  profit: Centavos // only items with a known cost
  unknownCostItems: number
  bestSellers: BestSeller[] // top 10 by amount
}

function sumTotals(sales: Sale[]): Centavos {
  return sales.reduce((total, sale) => total + sale.total, 0)
}

export function summarize(sales: Sale[], items: SaleItem[]): Summary {
  const live = sales.filter((sale) => sale.voidedAt === null)
  const liveIds = new Set(live.map((sale) => sale.id))
  const sellers = new Map<string, BestSeller>()
  let profit = 0
  let unknownCostItems = 0

  for (const item of items.filter((i) => liveIds.has(i.saleId))) {
    if (item.cost === null) unknownCostItems += 1
    else profit += (item.price - item.cost) * item.qty
    const seller = sellers.get(item.productId) ?? {
      productId: item.productId,
      name: item.name,
      qty: 0,
      total: 0,
    }
    seller.qty += item.qty
    seller.total += item.price * item.qty
    sellers.set(item.productId, seller)
  }

  return {
    salesTotal: sumTotals(live),
    salesCount: live.length,
    cash: sumTotals(live.filter((sale) => sale.payment === 'cash')),
    utang: sumTotals(live.filter((sale) => sale.payment === 'utang')),
    profit,
    unknownCostItems,
    bestSellers: [...sellers.values()]
      .sort((a, b) => b.total - a.total || b.qty - a.qty)
      .slice(0, 10),
  }
}
