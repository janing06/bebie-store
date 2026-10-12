import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import type { FieldHelp } from './field-help'
import { setOpenId } from './help-store'

const MARGIN = 16
const GAP = 8
const ARROW = 12

type Placement = { top: number; arrowLeft: number; above: boolean }

export function HelpPopover({
  id,
  help,
  anchor,
}: {
  id: string
  help: FieldHelp
  anchor: RefObject<HTMLButtonElement | null>
}) {
  const popover = useRef<HTMLDivElement>(null)
  const [placement, setPlacement] = useState<Placement | null>(null)

  useLayoutEffect(() => {
    if (!anchor.current || !popover.current) return
    const rect = anchor.current.getBoundingClientRect()
    const { offsetHeight, offsetWidth } = popover.current
    const above = rect.bottom + GAP + offsetHeight > window.innerHeight - MARGIN
    const centre = rect.left + rect.width / 2 - MARGIN
    setPlacement({
      top: above ? rect.top - GAP - offsetHeight : rect.bottom + GAP,
      arrowLeft: Math.min(Math.max(centre, ARROW), offsetWidth - ARROW),
      above,
    })
  }, [anchor])

  useEffect(() => {
    const close = () => setOpenId(null)
    function closeOutside(event: PointerEvent) {
      const target = event.target as Node
      if (!popover.current?.contains(target) && !anchor.current?.contains(target)) close()
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') close()
    }
    document.addEventListener('pointerdown', closeOutside)
    document.addEventListener('keydown', closeOnEscape)
    window.addEventListener('resize', close)
    window.addEventListener('scroll', close, true)
    return () => {
      document.removeEventListener('pointerdown', closeOutside)
      document.removeEventListener('keydown', closeOnEscape)
      window.removeEventListener('resize', close)
      window.removeEventListener('scroll', close, true)
    }
  }, [anchor])

  return createPortal(
    <div
      ref={popover}
      id={id}
      role="tooltip"
      style={{
        position: 'fixed',
        left: MARGIN,
        width: `calc(100vw - ${MARGIN * 2}px)`,
        top: placement?.top ?? 0,
        visibility: placement ? 'visible' : 'hidden',
      }}
      className="z-10 rounded-xl border border-brand bg-white p-3 text-left text-base font-normal tracking-normal normal-case shadow-lg"
    >
      <span
        aria-hidden
        style={{ left: (placement?.arrowLeft ?? 0) - ARROW / 2 }}
        className={`absolute h-3 w-3 rotate-45 border-brand bg-white ${
          placement?.above ? '-bottom-1.5 border-r border-b' : '-top-1.5 border-t border-l'
        }`}
      />
      <p className="text-sm text-slate-900">{help.bisaya}</p>
      <p className="text-xs text-slate-500">{help.english}</p>
    </div>,
    document.body,
  )
}
