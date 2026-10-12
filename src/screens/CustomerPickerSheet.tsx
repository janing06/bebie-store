import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { matchesSearch } from '../data/products'
import { addCustomer } from '../data/utang'
import { db } from '../db'
import { Notice, Sheet } from '../ui'
import { btn, errorMessage, inputClass } from '../ui-kit'

export function CustomerPickerSheet({
  onPick,
  onClose,
}: {
  onPick: (customerId: string) => void
  onClose: () => void
}) {
  const customers = useLiveQuery(() => db.customers.orderBy('name').toArray(), [])
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')
  const shown = (customers ?? []).filter(
    (customer) => customer.active && matchesSearch(customer.name, search),
  )

  async function addAndPick() {
    try {
      const customer = await addCustomer(db, search, '')
      onPick(customer.id)
    } catch (caught) {
      setError(errorMessage(caught))
    }
  }

  return (
    <Sheet title="Utang: who is buying?" onClose={onClose}>
      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="🔍 Name…"
        className={inputClass()}
      />
      <div className="flex max-h-72 flex-col overflow-y-auto">
        {shown.map((customer) => (
          <button
            key={customer.id}
            type="button"
            className="border-b border-slate-100 py-3 text-left text-base font-semibold"
            onClick={() => onPick(customer.id)}
          >
            {customer.name}
            {customer.note && (
              <span className="block text-xs font-normal text-slate-500">{customer.note}</span>
            )}
          </button>
        ))}
      </div>
      {search.trim() !== '' && (
        <button type="button" className={btn.ghost} onClick={addAndPick}>
          ＋ New customer "{search.trim()}"
        </button>
      )}
      {error && <Notice tone="bad">{error}</Notice>}
    </Sheet>
  )
}
