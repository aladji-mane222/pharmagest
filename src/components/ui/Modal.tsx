'use client'

import { ReactNode, useEffect } from 'react'
import Button from './Button'

type ModalVariant = 'default' | 'danger'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  /** Texte court expliquant l'action. Ignoré si `children` est fourni. */
  description?: string
  /** Contenu libre (formulaire, etc.) — remplace `description` si fourni */
  children?: ReactNode
  /** Si fourni, affiche les boutons Annuler/Confirmer en bas de la modale */
  onConfirm?: () => void | Promise<void>
  confirmLabel?: string
  cancelLabel?: string
  variant?: ModalVariant
  loading?: boolean
}

/**
 * Modale standard PharmaGest — remplace tous les window.confirm()/alert()
 * natifs du navigateur, notamment sur : archivage médicament, fournisseur,
 * client, dépense, activation/désactivation personnel (voir Phase 1 du plan
 * de consolidation, inventaire réel du 04/07/2026).
 *
 * Usage confirmation destructive :
 * <Modal
 *   open={confirmArchive}
 *   onClose={() => setConfirmArchive(false)}
 *   onConfirm={handleArchive}
 *   title="Archiver ce médicament ?"
 *   description="Il ne sera plus visible dans les listes actives. Cette action est réversible depuis le Super Admin si besoin."
 *   variant="danger"
 *   confirmLabel="Archiver"
 * />
 */
export default function Modal({
  open,
  onClose,
  title,
  description,
  children,
  onConfirm,
  confirmLabel = 'Confirmer',
  cancelLabel = 'Annuler',
  variant = 'default',
  loading = false,
}: ModalProps) {
  // Fermeture avec la touche Échap
  useEffect(() => {
    if (!open) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loading) onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [open, loading, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      {/* Fond assombri — clic pour fermer sauf pendant un chargement */}
      <div
        className="absolute inset-0 bg-navy/40"
        onClick={() => !loading && onClose()}
      />

      <div className="relative bg-white rounded-card shadow-lg w-full max-w-md p-6">
        <div className="flex items-start gap-3 mb-2">
          {variant === 'danger' && (
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-danger-bg text-danger text-lg">
              !
            </span>
          )}
          <div className="flex-1">
            <h2 id="modal-title" className="text-lg font-semibold text-navy">
              {title}
            </h2>
            {description && !children && (
              <p className="mt-1 text-sm text-gray-600">{description}</p>
            )}
          </div>
        </div>

        {children && <div className="mt-4">{children}</div>}

        {onConfirm && (
          <div className="mt-6 flex justify-end gap-3">
            <Button variant="secondary" onClick={onClose} disabled={loading}>
              {cancelLabel}
            </Button>
            <Button
              variant={variant === 'danger' ? 'danger' : 'primary'}
              onClick={onConfirm}
              loading={loading}
            >
              {confirmLabel}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
