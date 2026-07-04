import { cn } from './cn'

interface SkeletonProps {
  className?: string
}

/**
 * Remplace les textes "Chargement..." dispersés dans l'app par un
 * placeholder visuel cohérent. Composer la forme voulue via className :
 * <Skeleton className="h-4 w-32" />        // ligne de texte
 * <Skeleton className="h-10 w-10 rounded-full" /> // avatar
 */
export function Skeleton({ className }: SkeletonProps) {
  return <div className={cn('animate-pulse rounded-md bg-gray-200', className)} />
}

/** Skeleton prêt à l'emploi pour un tableau (n lignes × n colonnes) */
export function SkeletonTable({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-4">
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} className="h-4 flex-1" />
          ))}
        </div>
      ))}
    </div>
  )
}

/** Skeleton prêt à l'emploi pour une grille de cards (dashboard, KPIs) */
export function SkeletonCard() {
  return (
    <div className="rounded-card border border-gray-100 bg-white p-6 space-y-3">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="h-7 w-32" />
    </div>
  )
}
