import { ReactNode } from 'react'

interface EmptyStateProps {
  icon?: string
  title: string
  description?: string
  action?: ReactNode
}

/**
 * À utiliser pour toute liste vide (aucune vente, aucun client, aucune
 * commande...) plutôt qu'un tableau silencieux avec zéro ligne — voir
 * Phase 5 du plan de consolidation.
 *
 * <EmptyState
 *   icon="👥"
 *   title="Aucun client pour l'instant"
 *   description="Les clients apparaîtront ici une fois ajoutés."
 *   action={<Button onClick={ouvrirFormulaire}>Ajouter le premier client</Button>}
 * />
 */
export default function EmptyState({ icon = '📭', title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-4">
      <span className="text-4xl mb-3" aria-hidden>{icon}</span>
      <p className="text-base font-medium text-navy">{title}</p>
      {description && <p className="mt-1 text-sm text-gray-500 max-w-sm">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
