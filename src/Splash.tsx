import { useState } from 'react'
import { STORE_NAME } from './brand'
import { greeting } from './domain/messages'

export function Splash() {
  const [message] = useState(() => greeting(new Date()))
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-brand-soft">
      <img src="/icon.svg" alt="" className="h-24 w-24" />
      <h1 className="text-2xl font-extrabold text-brand">{STORE_NAME}</h1>
      <p className="text-slate-700">{message}</p>
    </div>
  )
}
