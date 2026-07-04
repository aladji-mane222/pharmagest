import { InputHTMLAttributes, SelectHTMLAttributes, forwardRef, ReactNode } from 'react'
import { cn } from './cn'

const fieldBaseClasses =
  'w-full rounded-card border px-3 py-2.5 text-sm text-navy transition-colors ' +
  'focus:outline-none focus:ring-2 focus:ring-mint/50 focus:border-mint ' +
  'disabled:bg-gray-50 disabled:text-gray-400'

interface FieldWrapperProps {
  label?: string
  error?: string
  hint?: string
  required?: boolean
  children: ReactNode
}

function FieldWrapper({ label, error, hint, required, children }: FieldWrapperProps) {
  return (
    <div className="w-full">
      {label && (
        <label className="mb-1.5 block text-sm font-medium text-navy">
          {label}
          {required && <span className="text-danger ml-0.5">*</span>}
        </label>
      )}
      {children}
      {error ? (
        <p className="mt-1 text-xs text-danger">{error}</p>
      ) : hint ? (
        <p className="mt-1 text-xs text-gray-500">{hint}</p>
      ) : null}
    </div>
  )
}

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
}

/**
 * Champ de saisie standardisé — remplace les <input className="..."> ad-hoc.
 * <Input label="Nom du médicament" required value={nom} onChange={...} error={erreurs.nom} />
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, required, className, ...rest }, ref) => (
    <FieldWrapper label={label} error={error} hint={hint} required={required}>
      <input
        ref={ref}
        className={cn(fieldBaseClasses, error ? 'border-danger' : 'border-gray-200', className)}
        {...rest}
      />
    </FieldWrapper>
  )
)
Input.displayName = 'Input'

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
  hint?: string
  children: ReactNode
}

/**
 * Liste déroulante standardisée — remplace les <select className="..."> ad-hoc.
 * <Select label="Catégorie" value={categorie} onChange={...}>
 *   <option value="">Toutes</option>
 *   ...
 * </Select>
 */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, hint, required, className, children, ...rest }, ref) => (
    <FieldWrapper label={label} error={error} hint={hint} required={required}>
      <select
        ref={ref}
        className={cn(fieldBaseClasses, 'bg-white', error ? 'border-danger' : 'border-gray-200', className)}
        {...rest}
      >
        {children}
      </select>
    </FieldWrapper>
  )
)
Select.displayName = 'Select'
