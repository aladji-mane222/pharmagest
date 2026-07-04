/**
 * Fusionne des classes conditionnelles sans dépendance externe (pas de clsx).
 * Usage : cn('base-class', condition && 'classe-si-vrai', autreCondition ? 'a' : 'b')
 */
export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ')
}
