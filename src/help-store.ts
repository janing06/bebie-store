// Only one popover is open at a time, so the open id lives in a tiny module-level store.
let openId: string | null = null

export const isOpen = (id: string) => openId === id
const listeners = new Set<() => void>()

export function setOpenId(id: string | null) {
  openId = id
  listeners.forEach((listener) => listener())
}

export function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
