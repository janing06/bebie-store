import { Info } from 'lucide-react'
import { useState } from 'react'
import type { FieldHelp } from './field-help'
import { HelpSheet } from './help-sheet'

/** Info button for a field. Place `button` right after the label text. Tapping it opens the help sheet. */
export function useFieldHelp(label: string, help?: FieldHelp) {
  const [open, setOpen] = useState(false)
  if (!help) return { button: null }

  const title = label.replace(/\s*₱?\s*\*?$/, '')
  const button = (
    <>
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="dialog"
        className="-my-3.5 -mr-3.5 flex select-none items-center justify-center p-3.5 text-brand active:opacity-60"
        // Keeps focus in the input the user is typing in.
        onMouseDown={(event) => event.preventDefault()}
        onClick={(event) => {
          event.preventDefault()
          setOpen(!open)
        }}
      >
        <Info aria-hidden size={18} className={open ? 'fill-brand text-white' : ''} />
        <span className="sr-only">{`Help: ${title}`}</span>
      </button>
      {open && <HelpSheet title={title} help={help} onClose={() => setOpen(false)} />}
    </>
  )
  return { button }
}
