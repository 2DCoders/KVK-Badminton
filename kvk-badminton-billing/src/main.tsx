import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { BrowserRouter } from 'react-router-dom'

import SessionExpiryBoundary from './components/session-expiry'
import { installSessionExpiryHandler } from './services/session-expiry'

installSessionExpiryHandler('admin')

// Release the focused number field before the browser handles the wheel.
document.addEventListener('wheel', (event) => {
  const input = event.target
  if (
    event.deltaY !== 0 &&
    !event.ctrlKey &&
    input instanceof HTMLInputElement &&
    input.type === 'number' &&
    input === document.activeElement
  ) {
    input.blur()
  }
}, { capture: true, passive: true })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <SessionExpiryBoundary>
        <App />
      </SessionExpiryBoundary>
    </BrowserRouter>
  </StrictMode>,
)
