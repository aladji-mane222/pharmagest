// CIBLE: src/lib/utils.ts
// Formater un montant en Francs Guinéens
export function formatMontant(montant: number): string {
  return new Intl.NumberFormat('fr-GN', {
    style: 'currency',
    currency: 'GNF',
    minimumFractionDigits: 0,
  }).format(montant)
}

// Formater une date en français
export function formatDate(date: Date | string): string {
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(date))
}

// Formater une date avec heure
export function formatDateTime(date: Date | string): string {
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date))
}

// Vérifier si un lot est proche de la péremption (90 jours)
export function isProchePremption(datePeremption: Date | string): boolean {
  const now = new Date()
  const peremption = new Date(datePeremption)
  const diffDays = Math.ceil((peremption.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  return diffDays <= 90 && diffDays > 0
}

// Vérifier si un lot est expiré
export function isExpire(datePeremption: Date | string): boolean {
  return new Date(datePeremption) < new Date()
}

// Calculer le stock total d'un médicament depuis ses lots
export function calculerStockTotal(lots: { quantite: number; actif: boolean }[]): number {
  return lots
    .filter((lot) => lot.actif)
    .reduce((total, lot) => total + lot.quantite, 0)
}

// Générer un numéro de recu unique
export function genererNumeroRecu(): string {
  const now = new Date()
  const date = now.toISOString().slice(0, 10).replace(/-/g, '')
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0')
  return `REC-${date}-${random}`
}

// Réponses API
export function apiSuccess(data: unknown, status = 200) {
  return Response.json({ success: true, data }, { status })
}

export function apiError(message: string, status = 400, details?: unknown) {
  return Response.json({ success: false, error: message, ...(details !== undefined && { details }) }, { status })
}