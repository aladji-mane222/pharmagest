'use client'

import { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from './cn'

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost'
type ButtonSize = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  icon?: ReactNode
  children: ReactNode
}

const variantClasses: Record<ButtonVariant, string> = {
  // text-navy est theme-reactif (devient clair en sombre) car utilise
  // partout comme couleur de texte principale — mais ICI le fond reste
  // mint (vif) dans les deux themes, donc on fige le texte en fonce avec
  // dark:text-[#0D2847] pour ne pas perdre le contraste en theme sombre.
  primary:   'bg-mint text-navy dark:text-[#0D2847] hover:bg-mint-dark',
  secondary: 'bg-surface text-navy border border-navy/20 hover:bg-app-bg',
  danger:    'bg-danger text-white hover:bg-danger/90',
  ghost:     'bg-transparent text-navy hover:bg-navy/5',
}

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'text-sm px-3 py-1.5',
  md: 'text-sm px-4 py-2.5',
  lg: 'text-base px-5 py-3',
}

/**
 * Bouton standard PharmaGest — remplace les <button className="..."> ad-hoc.
 *
 * <Button variant="primary">Valider la vente</Button>
 * <Button variant="danger" loading={enCours} onClick={archiver}>Archiver</Button>
 */
export default function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  disabled,
  children,
  className,
  ...rest
}: ButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-card font-medium transition-colors',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
      {...rest}
    >
      {loading ? (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
      ) : (
        icon
      )}
      {children}
    </button>
  )
}
