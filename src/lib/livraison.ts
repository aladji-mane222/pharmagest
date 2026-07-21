
// Constantes partagees liees au suivi des livraisons fournisseur.
// Centralisees ici pour que le badge de retard par commande
// (fournisseurs/commandes) et le calcul de fiabilite par fournisseur
// (api/fournisseurs) utilisent exactement la meme regle — decision
// prise avec Nabe le 19/07/2026.

// Nombre de jours au-dela de la date prevue avant de considerer une
// livraison comme "en retard" (au lieu de compter le moindre depassement)
export const TOLERANCE_RETARD_JOURS = 2

// Nombre minimum de commandes recues (avec date prevue renseignee) sur
// les 90 derniers jours avant d'afficher un pourcentage de fiabilite —
// en dessous, un seul cas isole donnerait un pourcentage trompeur
// (0% ou 100% sur une seule commande n'a pas de sens statistique)
export const SEUIL_MIN_COMMANDES_FIABILITE = 3

// Fenetre glissante sur laquelle la fiabilite est calculee
export const FENETRE_FIABILITE_JOURS = 90

export type NiveauFiabilite = 'fiable' | 'generalement_fiable' | 'souvent_en_retard' | 'insuffisant'

export interface Fiabilite {
  totalCommandesRecues: number
  commandesATemps: number
  pourcentageATemps: number | null
  niveau: NiveauFiabilite
}

export function calculerNiveauFiabilite(total: number, aTemps: number): { pourcentageATemps: number | null; niveau: NiveauFiabilite } {
  if (total < SEUIL_MIN_COMMANDES_FIABILITE) {
    return { pourcentageATemps: null, niveau: 'insuffisant' }
  }
  const pourcentage = Math.round((aTemps / total) * 100)
  let niveau: NiveauFiabilite
  if (pourcentage >= 90) niveau = 'fiable'
  else if (pourcentage >= 70) niveau = 'generalement_fiable'
  else niveau = 'souvent_en_retard'
  return { pourcentageATemps: pourcentage, niveau }
}

export const LABELS_NIVEAU_FIABILITE: Record<NiveauFiabilite, string> = {
  fiable:               'Fiable',
  generalement_fiable:  'Généralement fiable',
  souvent_en_retard:    'Souvent en retard',
  insuffisant:          'Historique insuffisant',
}