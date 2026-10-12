import { Info } from 'lucide-react'
import { useId, useState } from 'react'
import type { FieldHelp } from './field-help'

/** Info button and help box for a field. Place `button` after the label text and `box` under the label row. */
export function useFieldHelp(label: string, help?: FieldHelp) {
  const [open, setOpen] = useState(false)
  const boxId = useId()
  if (!help) return { button: null, box: null }

  const button = (
    <button
      type="button"
      aria-expanded={open}
      aria-controls={boxId}
      className="-my-3.5 -mr-3.5 flex select-none items-center justify-center p-3.5 text-brand active:opacity-60"
      onClick={(event) => {
        event.preventDefault()
        setOpen(!open)
      }}
    >
      <Info aria-hidden size={18} className={open ? 'fill-brand text-white' : ''} />
      <span className="sr-only">{`Help: ${label.replace(/\s*₱?\s*\*?$/, '')}`}</span>
    </button>
  )
  const box = open && (
    <div
      id={boxId}
      className="rounded-lg border border-brand bg-brand-soft p-2 normal-case tracking-normal"
    >
      <p className="text-sm font-normal text-slate-900">{help.bisaya}</p>
      <p className="text-xs font-normal text-slate-500">{help.english}</p>
    </div>
  )
  return { button, box }
}
