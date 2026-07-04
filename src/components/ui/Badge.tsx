import { ReactNode } from 'react'
import { cn } from './cn'

type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral'

interface BadgeProps {
  children: ReactNode
  variant?: BadgeVariant
  className?: string
}

const variantClasses: Record<BadgeVariant, string> = {
  success: 'bg-success-bg text-success-text',
  warning: 'bg-warning-bg text-warning-text',
  danger:  'bg-danger-bg text-danger-text',
  info:    'bg-info-bg text-info-text',
  neutral: 'bg-gray-100 text-gray-700',
}

/**
 * Badge générique — utiliser avec un variant explicite pour un cas ponctuel :
 * <Badge variant="warning">En attente</Badge>
 *
 * Pour les statuts métier récurrents (ventes, commandes, inventaire),
 * préférer les helpers ci-dessous pour garder un mapping unique et cohérent
 * dans toute l'app plutôt qu'un switch/case répété sur chaque page.
 */
export default function Badge({ children, variant = 'neutral', className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        variantClasses[variant],
        className
      )}
    >
      {children}
    </span>
  )
}

// ─── Mappings statuts métier — source unique, à réutiliser partout ──────────

const statutVenteMap: Record<string, { label: string; variant: BadgeVariant }> = {
  COMPLETE:  { label: 'Complète',  variant: 'success' },
  PARTIELLE: { label: 'Partielle', variant: 'warning' },
  ANNULEE:   { label: 'Annulée',   variant: 'danger' },
}

export function BadgeStatutVente({ statut }: { statut: string }) {
  const config = statutVenteMap[statut] ?? { label: statut, variant: 'neutral' as const }
  return <Badge variant={config.variant}>{config.label}</Badge>
}

const statutCommandeMap: Record<string, { label: string; variant: BadgeVariant }> = {
  BROUILLON: { label: 'Brouillon', variant: 'neutral' },
  ENVOYEE:   { label: 'Envoyée',   variant: 'info' },
  RECUE:     { label: 'Reçue',     variant: 'success' },
  ANNULEE:   { label: 'Annulée',   variant: 'danger' },
}

export function BadgeStatutCommande({ statut }: { statut: string }) {
  const config = statutCommandeMap[statut] ?? { label: statut, variant: 'neutral' as const }
  return <Badge variant={config.variant}>{config.label}</Badge>
}

/** Badge stock — à partir du niveau réel vs seuil, pas d'un statut enum */
export function BadgeStock({ quantite, seuil }: { quantite: number; seuil: number }) {
  if (quantite <= 0) return <Badge variant="danger">Rupture</Badge>
  if (quantite < seuil) return <Badge variant="warning">Stock bas</Badge>
  return <Badge variant="success">Stock OK</Badge>
}
