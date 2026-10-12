import { Info } from 'lucide-react'
import { useId, useRef, useSyncExternalStore } from 'react'
import type { FieldHelp } from './field-help'
import { HelpPopover } from './help-popover'
import { isOpen, setOpenId, subscribe } from './help-store'

/** Info button for a field. Place `button` right after the label text. Its popover floats over the form. */
export function useFieldHelp(label: string, help?: FieldHelp) {
  const id = useId()
  const anchor = useRef<HTMLButtonElement>(null)
  const open = useSyncExternalStore(subscribe, () => isOpen(id))
  if (!help) return { button: null }

  const button = (
    <>
      <button
        ref={anchor}
        type="button"
        aria-expanded={open}
        aria-controls={id}
        className="-my-3.5 -mr-3.5 flex select-none items-center justify-center p-3.5 text-brand active:opacity-60"
        // Keeps focus in the input the user is typing in.
        onMouseDown={(event) => event.preventDefault()}
        onClick={(event) => {
          event.preventDefault()
          setOpenId(open ? null : id)
        }}
      >
        <Info aria-hidden size={18} className={open ? 'fill-brand text-white' : ''} />
        <span className="sr-only">{`Help: ${label.replace(/\s*₱?\s*\*?$/, '')}`}</span>
      </button>
      {open && <HelpPopover id={id} help={help} anchor={anchor} />}
    </>
  )
  return { button }
}
