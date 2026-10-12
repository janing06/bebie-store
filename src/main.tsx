import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { App } from './App'
import { ErrorBoundary } from './ErrorBoundary'

// Ask Chrome not to clear the store data when the phone runs low on space.
navigator.storage
  ?.persist?.()
  .catch((error: unknown) => console.error('Persistent storage request failed', error))

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
