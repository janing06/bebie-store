import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { salesBetween } from '../data/sales'
import { db } from '../db'
import { customRange, rangeFor, toYmd, type RangeKey } from '../domain/dates'
import { cheer } from '../domain/messages'
import { summarize } from '../domain/reports'
import { formatPesos } from '../money'
import { Field, Notice, Screen } from '../ui'
import { btn, inputClass } from '../ui-kit'

type ReportRange = RangeKey | 'custom'
const RANGE_LABELS: Record<ReportRange, string> = {
  today: 'Today',
  '7days': '7 days',
  month: 'Month',
  custom: 'Custom',
}

export function ReportsScreen() {
  const [now] = useState(() => new Date())
  const [key, setKey] = useState<ReportRange>('today')
  const [from, setFrom] = useState(() => toYmd(now))
  const [to, setTo] = useState(() => toYmd(now))

  const range = key === 'custom' ? customRange(from, to) : rangeFor(key, now)
  const startMs = range?.start.getTime() ?? null
  const endMs = range?.end.getTime() ?? null
  const data = useLiveQuery(
    () =>
      startMs === null || endMs === null
        ? null
        : salesBetween(db, new Date(startMs), new Date(endMs)),
    [startMs, endMs],
  )
  const summary = data ? summarize(data.sales, data.items) : null
  const message = summary ? cheer(summary.salesCount, key === 'today') : null

  return (
    <Screen title="Reports" nav>
      <div className="flex flex-wrap gap-2">
        {(Object.keys(RANGE_LABELS) as ReportRange[]).map((option) => (
          <button
            key={option}
            type="button"
            className={key === option ? btn.chipOn : btn.chip}
            onClick={() => setKey(option)}
          >
            {RANGE_LABELS[option]}
          </button>
        ))}
      </div>
      {key === 'custom' && (
        <div className="grid grid-cols-2 gap-2">
          <Field label="From">
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className={inputClass()}
            />
          </Field>
          <Field label="To">
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className={inputClass()}
            />
          </Field>
        </div>
      )}
      {range === null && <Notice tone="bad">Pick a start date on or before the end date.</Notice>}

      {summary && (
        <>
          {message && <Notice tone="good">{message}</Notice>}
          <div className="flex gap-2">
            <Stat
              label="Sales"
              value={formatPesos(summary.salesTotal)}
              note={`${summary.salesCount} ${summary.salesCount === 1 ? 'sale' : 'sales'}`}
            />
            <Stat
              label="Profit"
              value={formatPesos(summary.profit)}
              note={
                summary.unknownCostItems > 0
                  ? `profit unknown for ${summary.unknownCostItems} ${summary.unknownCostItems === 1 ? 'item' : 'items'}`
                  : 'from items with a cost'
              }
              good
            />
          </div>
          <div className="flex justify-between border-b border-slate-100 py-2">
            <span>Cash</span>
            <span>{formatPesos(summary.cash)}</span>
          </div>
          <div className="flex justify-between border-b border-slate-100 py-2">
            <span>Utang (new)</span>
            <span>{formatPesos(summary.utang)}</span>
          </div>
          <p className="text-xs font-semibold tracking-wide text-slate-500">BEST SELLERS</p>
          <ul className="divide-y divide-slate-100">
            {summary.bestSellers.map((seller, index) => (
              <li key={seller.productId} className="flex justify-between py-2">
                <span>
                  {index + 1}. {seller.name}
                </span>
                <span>
                  {seller.qty} pcs · {formatPesos(seller.total)}
                </span>
              </li>
            ))}
          </ul>
          {summary.salesCount === 0 && (
            <p className="text-sm text-slate-500">No sales in this period.</p>
          )}
        </>
      )}
    </Screen>
  )
}

function Stat({
  label,
  value,
  note,
  good = false,
}: {
  label: string
  value: string
  note: string
  good?: boolean
}) {
  return (
    <div className="flex-1 rounded-xl border border-slate-200 p-3">
      {label}
      <div className={`text-2xl font-bold ${good ? 'text-brand' : ''}`}>{value}</div>
      <div className="text-xs text-slate-500">{note}</div>
    </div>
  )
}
