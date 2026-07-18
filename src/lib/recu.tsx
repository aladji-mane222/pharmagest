// CIBLE: src/lib/recu.tsx (ATTENTION: remplace src/lib/recu.ts — supprime l'ancien .ts, il devient .tsx)
import { pdf } from '@react-pdf/renderer'
import RecuPDF from '@/components/ventes/RecuPDF'
export interface LigneRecu {
  nom: string
  quantite: number
  prixUnitaire: number
}

export interface PaiementRecu {
  modePaiement: string
  montant: number
}

export interface DonneesRecu {
  nomPharmacie: string
  numero: string
  date: string
  lignes: LigneRecu[]
  montantTotal: number
  paiements: PaiementRecu[]
  monnaie: number
  resteADu: number
  clientNom?: string | null
  formatRecu: 'A4' | 'THERMIQUE_58' | 'THERMIQUE_80'
}

export const MODE_LABELS_RECU: Record<string, string> = {
  ESPECES:           'Especes',
  MOBILE_MONEY:      'Mobile Money',
  ORANGE_MONEY:      'Orange Money',
  MTN_MONEY:         'MTN Money',
  PAIEMENT_MARCHAND: 'Paiement Marchand',
  CARTE:             'Carte',
  CREDIT:            'Credit',
  MIXTE:             'Mixte',
}

/**
 * Genere le recu en PDF reel et le telecharge.
 *
 * Pourquoi ce choix, apres plusieurs tentatives infructueuses avec le
 * dialogue d'impression du navigateur (CSS @media print, puis @page size
 * force dans une fenetre dediee — voir l'historique dans les commits
 * precedents) : la taille de page dependait a chaque fois de la
 * destination choisie par l'utilisateur dans le dialogue d'impression
 * (Fichier PDF, imprimante virtuelle, imprimante reelle), avec un resultat
 * different — et parfois casse — selon ce choix. Ce n'etait jamais garanti,
 * juste une hypothese qui marchait ou pas selon le contexte.
 *
 * Ici, la taille de page (58mm / 80mm / A4) est ecrite directement dans les
 * octets du fichier PDF au moment de sa creation (@react-pdf/renderer, deja
 * utilise dans ce projet pour les rapports). Un fichier PDF qui déclare
 * faire 58mm de large fera TOUJOURS 58mm de large dans n'importe quel
 * lecteur PDF ou logiciel d'impression — ce n'est plus une negociation
 * avec un pilote d'imprimante, c'est une propriete figee du fichier.
 * Le seul maillon encore hors de notre controle est la toute derniere
 * etape (le logiciel d'impression thermique doit accepter d'imprimer un
 * PDF a sa taille native plutot que de le re-mettre a l'echelle) — mais
 * c'est un comportement standard de tout lecteur PDF serieux.
 */
export async function telechargerRecuPDF(d: DonneesRecu): Promise<void> {
  const blob = await pdf(<RecuPDF donnees={d} />).toBlob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `recu-${d.numero}.pdf`
  a.click()
  URL.revokeObjectURL(url)
}

/**
 * Ouvre le recu PDF dans un nouvel onglet plutot que de le telecharger —
 * pratique pour verifier/imprimer immediatement depuis le lecteur PDF du
 * navigateur (dont le bouton imprimer respecte la taille de page du
 * fichier, contrairement a imprimer une page HTML classique).
 */
export async function ouvrirRecuPDF(d: DonneesRecu): Promise<void> {
  const blob = await pdf(<RecuPDF donnees={d} />).toBlob()
  const url = URL.createObjectURL(blob)
  const fenetre = window.open(url, '_blank')
  if (!fenetre) {
    URL.revokeObjectURL(url)
    throw new Error('POPUP_BLOQUE')
  }
}

export function construireMessageWhatsApp(d: DonneesRecu): string {
  const lignesTexte = d.lignes
    .map((l) => `- ${l.nom} x${l.quantite} = ${l.prixUnitaire * l.quantite} GNF`)
    .join('%0A')
  const paiementsTexte = d.paiements
    .map((p) => `${MODE_LABELS_RECU[p.modePaiement] ?? p.modePaiement}: ${p.montant} GNF`)
    .join('%0A')
  const clientTexte = d.clientNom ? `%0AClient: ${d.clientNom}` : ''
  const monnaieTexte = d.monnaie > 0 ? `%0AMonnaie: ${d.monnaie} GNF` : ''
  const creditTexte = d.resteADu > 0 ? `%0AReste a payer (credit): ${d.resteADu} GNF` : ''

  return `*RECU - ${d.nomPharmacie}*%0A%0ARecu: ${d.numero}%0ADate: ${d.date}${clientTexte}%0A%0A*Articles:*%0A${lignesTexte}%0A%0A*Total: ${d.montantTotal} GNF*%0A${paiementsTexte}${monnaieTexte}${creditTexte}%0A%0AMerci de votre confiance!`
}