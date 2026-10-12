import { useLiveQuery } from 'dexie-react-hooks'
import { Plus } from 'lucide-react'
import { useRef, useState } from 'react'
import { matchesSearch } from '../data/products'
import { addCustomer } from '../data/utang'
import { db } from '../db'
import { Notice, SearchInput, Sheet } from '../ui'
import { btn, errorMessage } from '../ui-kit'

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
  const [busy, setBusy] = useState(false)
  // A ref, not state: two taps in the same frame both see the old state value.
  const busyRef = useRef(false)
  const shown = (customers ?? []).filter(
    (customer) => customer.active && matchesSearch(customer.name, search),
  )

  async function addAndPick() {
    if (busyRef.current) return
    busyRef.current = true
    setBusy(true)
    try {
      const customer = await addCustomer(db, search, '')
      onPick(customer.id)
    } catch (caught) {
      setError(errorMessage(caught))
      busyRef.current = false
      setBusy(false)
    }
  }

  return (
    <Sheet title="Utang: who is buying?" onClose={onClose}>
      <SearchInput value={search} onChange={setSearch} placeholder="Name…" />
      <div className="flex max-h-72 flex-col overflow-y-auto">
        {shown.map((customer) => (
          <button
            key={customer.id}
            type="button"
            className="min-h-12 select-none border-b border-slate-100 py-3 text-left text-base font-semibold active:bg-slate-100"
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
        <button
          type="button"
          className={`${btn.ghost} flex items-center justify-center gap-2`}
          disabled={busy}
          onClick={addAndPick}
        >
          <Plus aria-hidden size={20} />
          New customer "{search.trim()}"
        </button>
      )}
      {error && <Notice tone="bad">{error}</Notice>}
    </Sheet>
  )
}
