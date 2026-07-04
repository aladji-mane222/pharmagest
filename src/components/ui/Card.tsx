import { HTMLAttributes, ReactNode } from 'react'
import { cn } from './cn'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
  padding?: 'none' | 'sm' | 'md' | 'lg'
  hover?: boolean
}

const paddingClasses = {
  none: '',
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-8',
}

/**
 * Conteneur standard PharmaGest — fond blanc, rayon 14px, ombre légère.
 * Remplace les <div className="bg-white rounded-xl shadow ..."> dupliqués
 * un peu différemment sur chaque page.
 */
export default function Card({
  children,
  padding = 'md',
  hover = false,
  className,
  ...rest
}: CardProps) {
  return (
    <div
      className={cn(
        'bg-white rounded-card shadow-sm border border-gray-100',
        hover && 'transition-shadow hover:shadow-md',
        paddingClasses[padding],
        className
      )}
      {...rest}
    >
      {children}
    </div>
  )
}
