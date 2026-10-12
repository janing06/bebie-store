import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import type { FieldHelp } from './field-help'
import { Sheet } from './ui'
import { btn } from './ui-kit'

export function HelpSheet({
  title,
  help,
  onClose,
}: {
  title: string
  help: FieldHelp
  onClose: () => void
}) {
  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [onClose])

  // Portaled so it stays on top of an open sheet instead of being clipped by it.
  return createPortal(
    <Sheet title={title} onClose={onClose}>
      <p className="text-lg leading-snug text-slate-900">{help.bisaya}</p>
      <p className="text-sm text-slate-500">{help.english}</p>
      <button type="button" className={btn.primary} onClick={onClose}>
        Sige, gets nako
      </button>
    </Sheet>,
    document.body,
  )
}
