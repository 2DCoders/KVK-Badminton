import * as React from 'react'
import { createPortal } from 'react-dom'
import { CheckCircle, AlertTriangle, XCircle, X } from 'lucide-react'

export type AlertVariant = 'success' | 'error' | 'warning' | 'info'

export interface AlertProps {
  variant?: AlertVariant
  title?: string
  description?: React.ReactNode
  dismissible?: boolean
  onClose?: () => void
  autoCloseMs?: number
  exitDurationMs?: number
  className?: string
}

const variantStyles: Record<AlertVariant, { bg: string; ring: string; icon: React.ReactNode }> = {
  success: { bg: 'bg-emerald-50 border-emerald-100', ring: 'ring-emerald-200', icon: <CheckCircle className="w-5 h-5 text-emerald-600" /> },
  error: { bg: 'bg-red-50 border-red-100', ring: 'ring-red-200', icon: <XCircle className="w-5 h-5 text-red-600" /> },
  warning: { bg: 'bg-amber-50 border-amber-100', ring: 'ring-amber-200', icon: <AlertTriangle className="w-5 h-5 text-amber-600" /> },
  info: { bg: 'bg-blue-50 border-blue-100', ring: 'ring-blue-200', icon: <CheckCircle className="w-5 h-5 text-blue-600" /> },
}

export function Alert({
  variant = 'info',
  title,
  description,
  dismissible = true,
  onClose,
  autoCloseMs = 5000,
  exitDurationMs = 240,
  className = '',
}: AlertProps) {
  const styles = variantStyles[variant]
  const [closing, setClosing] = React.useState(false)

  React.useEffect(() => {
    if (!autoCloseMs) return undefined

    const autoCloseTimer = window.setTimeout(() => {
      setClosing(true)
    }, autoCloseMs)

    return () => window.clearTimeout(autoCloseTimer)
  }, [autoCloseMs])

  React.useEffect(() => {
    if (!closing || !onClose) return undefined

    const closeTimer = window.setTimeout(() => {
      onClose()
    }, exitDurationMs)

    return () => window.clearTimeout(closeTimer)
  }, [closing, exitDurationMs, onClose])

  const handleClose = () => {
    if (closing) return
    setClosing(true)
  }

  return createPortal(
    <div className="fixed right-4 top-4 w-[calc(100vw-2rem)] max-w-sm pointer-events-none sm:right-6 sm:top-6" style={{ zIndex: 1000000 }} role="presentation">
      <style>
        {`@keyframes alert-slide-in {
          0% { opacity: 0; transform: translateX(24px) scale(0.98); }
          100% { opacity: 1; transform: translateX(0) scale(1); }
        }
        @keyframes alert-slide-out {
          0% { opacity: 1; transform: translateX(0) scale(1); }
          100% { opacity: 0; transform: translateX(24px) scale(0.98); }
        }`}
      </style>

      <div
        role="alert"
        className={`pointer-events-auto rounded-2xl border ${styles.bg} shadow-2xl shadow-gray-950/10 backdrop-blur-xl ring-1 ${styles.ring} overflow-hidden ${className}`}
        style={{ animation: closing ? 'alert-slide-out 240ms ease-in forwards' : 'alert-slide-in 240ms ease-out' }}
      >
        <div className="absolute inset-0 bg-linear-to-r from-white/40 via-transparent to-transparent" />
        <div className="relative flex items-start gap-3 p-4 md:p-4">
          <div className="shrink-0 flex items-center justify-center rounded-xl bg-white/70 p-2 shadow-sm">
            {styles.icon}
          </div>

          <div className="min-w-0 flex-1">
            {title && <div className="text-sm font-semibold text-gray-900">{title}</div>}
            {description && <div className="mt-1 text-sm text-gray-600">{description}</div>}
          </div>

          {dismissible && (
            <button
              onClick={handleClose}
              aria-label="Close alert"
              className="ml-2 rounded-lg p-2 text-gray-500 hover:bg-white/50 hover:text-gray-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}

export default Alert
