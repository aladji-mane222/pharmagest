'use client'

import { createContext, useCallback, useContext, useState, ReactNode } from 'react'
import { cn } from './cn'

type ToastVariant = 'success' | 'error' | 'info'

interface ToastItem {
  id: string
  message: string
  variant: ToastVariant
}

interface ToastContextValue {
  showToast: (message: string, variant?: ToastVariant) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

const variantClasses: Record<ToastVariant, string> = {
  success: 'bg-success text-white',
  error:   'bg-danger text-white',
  info:    'bg-navy text-white',
}

/**
 * Remplace les alert() bruts du navigateur — notamment ceux identifiés
 * dans inventaire/page.tsx, ventes/page.tsx, ventes/[id]/page.tsx et
 * credits/page.tsx (audit du 04/07/2026). Non-bloquant, disparaît seul.
 *
 * À placer une seule fois dans providers.tsx, tout en haut de l'arbre.
 * Ensuite dans n'importe quelle page cliente :
 *
 *   const { showToast } = useToast()
 *   showToast('Panier vide', 'error')
 *   showToast('Inventaire validé avec succès', 'success')
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const showToast = useCallback((message: string, variant: ToastVariant = 'info') => {
    const id = crypto.randomUUID()
    setToasts((prev) => [...prev, { id, message, variant }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 4000)
  }, [])

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-sm">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={cn(
              'rounded-card px-4 py-3 text-sm font-medium shadow-lg animate-toast-in',
              variantClasses[toast.variant]
            )}
            role="status"
          >
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) {
    throw new Error('useToast doit être utilisé à l’intérieur de <ToastProvider>')
  }
  return ctx
}
