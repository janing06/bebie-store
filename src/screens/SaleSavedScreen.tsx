import { Check } from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useLocation, useParams } from 'wouter'
import { STORE_NAME } from '../brand'
import { db } from '../db'
import { formatPesos } from '../money'
import { Screen } from '../ui'
import { btn } from '../ui-kit'

export function SaleSavedScreen() {
  const { id } = useParams<{ id: string }>()
  const [, navigate] = useLocation()
  const data = useLiveQuery(async () => {
    const sale = await db.sales.get(id)
    const customer = sale?.customerId ? await db.customers.get(sale.customerId) : undefined
    return { sale, customer }
  }, [id])

  if (!data) return null
  const { sale, customer } = data
  if (!sale) {
    return (
      <Screen title={STORE_NAME} back>
        <p>Sale not found.</p>
      </Screen>
    )
  }

  return (
    <Screen title={STORE_NAME}>
      <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-brand text-white">
          <Check aria-hidden size={48} strokeWidth={3} />
        </div>
        <h2 className="text-2xl font-bold">Sale saved</h2>
        <p className="text-slate-600">
          {formatPesos(sale.total)} ·{' '}
          {sale.payment === 'cash' ? 'Cash' : `Utang · ${customer?.name ?? ''}`}
        </p>
        {sale.cashReceived !== null && (
          <div className="w-4/5 rounded-xl border border-slate-200 p-3">
            Give change
            <div className="text-4xl font-bold text-brand">
              {formatPesos(sale.cashReceived - sale.total)}
            </div>
          </div>
        )}
        <button
          type="button"
          className={`${btn.primary} w-4/5`}
          onClick={() => navigate('/', { replace: true })}
        >
          Next customer
        </button>
      </div>
    </Screen>
  )
}
