import { ReactNode } from 'react'

interface PageHeaderProps {
  title: string
  description?: string
  actions?: ReactNode
}

/**
 * En-tête de page standard — titre + description à gauche, actions
 * (bouton principal, filtres) à droite. Pattern répété sur presque toutes
 * les pages de l'app (médicaments, clients, commandes, rapports...).
 *
 * <PageHeader
 *   title="Médicaments"
 *   description="Gérez votre catalogue et vos lots"
 *   actions={<Button onClick={ouvrirFormulaire}>+ Nouveau médicament</Button>}
 * />
 */
export default function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
      <div>
        <h1 className="text-2xl font-semibold text-navy">{title}</h1>
        {description && <p className="mt-1 text-sm text-gray-500">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-3">{actions}</div>}
    </div>
  )
}
