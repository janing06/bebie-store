import { Component, useState, type ErrorInfo, type ReactNode } from 'react'
import { db } from './db'
import { shareBackup } from './share-backup'
import { btn } from './ui-kit'

export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children
    return <CrashScreen message={this.state.error.message} />
  }
}

function CrashScreen({ message }: { message: string }) {
  const [status, setStatus] = useState('')

  async function backup() {
    try {
      const result = await shareBackup(db)
      setStatus(result === 'cancelled' ? '' : 'Backup saved.')
    } catch (error) {
      console.error(error)
      setStatus('Backup failed. Please take a screenshot and send it to your son.')
    }
  }

  return (
    <div className="flex min-h-dvh flex-col justify-center gap-4 p-6">
      <h1 className="text-xl font-bold">Something went wrong</h1>
      <p className="rounded-xl bg-red-50 p-3 text-red-900">{message}</p>
      <p className="text-slate-700">
        Your data is still on this phone. Make a backup, then reload.
      </p>
      <button type="button" className={btn.primary} onClick={backup}>
        Backup now
      </button>
      <button type="button" className={btn.ghost} onClick={() => window.location.reload()}>
        Reload
      </button>
      {status && <p className="text-center text-sm">{status}</p>}
    </div>
  )
}
