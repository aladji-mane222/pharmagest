import { formatMontant } from '@/lib/utils'
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

function echapperHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

/**
 * Imprime le recu dans une fenetre dediee, entierement independante de la
 * page principale.
 *
 * Historique des tentatives precedentes, pour ne pas relancer les memes
 * erreurs :
 * 1) CSS @media print injecte dans la page via styled-jsx — echec, Chrome
 *    retombait sur A4 quel que soit le format choisi.
 * 2) Fenetre dediee + @page { size: 80mm 1000mm } — pire : quand la
 *    destination d'impression (Fichier PDF, imprimante virtuelle) ne
 *    supporte pas cette taille personnalisee, elle retombe sur A4 mais
 *    essaie quand meme de faire tenir la hauteur de page declaree (1000mm)
 *    sur une seule feuille A4 (297mm) — resultat : tout le contenu est
 *    reduit a une echelle minuscule, illisible.
 *
 * Conclusion : forcer une taille de papier personnalisee depuis le CSS
 * n'est pas fiable ici (ca depend de si la destination choisie dans le
 * dialogue d'impression du navigateur supporte des formats personnalises).
 * On ne force donc plus AUCUNE taille de page — seulement les marges — et
 * on laisse le contenu s'afficher a sa largeur naturelle (etroite pour le
 * thermique). Sur une imprimante thermique physique selectionnee comme
 * destination, le pilote Windows definit lui-meme le format 58/80mm et le
 * rendu sera correct. Sur A4/PDF, le reçu apparait comme une colonne
 * etroite en haut de la page — lisible, pas de mise a l'echelle foireuse,
 * juste pas plein cadre (attendu, puisque le format cible est different).
 *
 * Leve une erreur si la fenetre est bloquee par le navigateur (pop-up
 * bloque) — a la charge de l'appelant d'afficher un Toast, pas de alert()
 * natif ici.
 */
export function imprimerRecu(d: DonneesRecu): void {
  const largeur = d.formatRecu === 'A4' ? '100%' : d.formatRecu === 'THERMIQUE_58' ? '48mm' : '72mm'
  const fontSize = d.formatRecu === 'A4' ? '14px' : d.formatRecu === 'THERMIQUE_58' ? '10px' : '11px'
  const padding = d.formatRecu === 'A4' ? '24px' : '8px'

  const lignesHtml = d.lignes.map((l) => `
    <div style="margin-bottom:6px;">
      <div>${echapperHtml(l.nom)}</div>
      <div style="display:flex;justify-content:space-between;color:#666;">
        <span>${l.quantite} x ${echapperHtml(formatMontant(l.prixUnitaire))}</span>
        <span style="font-weight:600;color:#222;">${echapperHtml(formatMontant(l.prixUnitaire * l.quantite))}</span>
      </div>
    </div>
  `).join('')

  const paiementsHtml = d.paiements.map((p) => `
    <div style="display:flex;justify-content:space-between;color:#555;">
      <span>${echapperHtml(MODE_LABELS_RECU[p.modePaiement] ?? p.modePaiement)}</span>
      <span>${echapperHtml(formatMontant(p.montant))}</span>
    </div>
  `).join('')

  const monnaieHtml = d.monnaie > 0 ? `
    <div style="display:flex;justify-content:space-between;color:#555;">
      <span>Monnaie</span><span>${echapperHtml(formatMontant(d.monnaie))}</span>
    </div>` : ''

  const creditHtml = d.resteADu > 0 ? `
    <div style="display:flex;justify-content:space-between;color:#c0392b;font-weight:600;">
      <span>Reste a payer (credit${d.clientNom ? ' — ' + echapperHtml(d.clientNom) : ''})</span>
      <span>${echapperHtml(formatMontant(d.resteADu))}</span>
    </div>` : ''

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>Recu ${echapperHtml(d.numero)}</title>
<style>
  @page { margin: 0; }
  * { box-sizing: border-box; }
  body {
    font-family: Arial, Helvetica, sans-serif;
    width: ${largeur};
    margin: 0 auto;
    padding: ${padding};
    font-size: ${fontSize};
    color: #111;
  }
  .centre { text-align: center; }
  .nom-pharmacie { font-weight: 700; font-size: 1.15em; color: #0D2847; }
  .meta { color: #999; font-size: 0.85em; margin-top: 2px; }
  hr { border: none; border-top: 1px solid #ddd; margin: 10px 0; }
  .total { display: flex; justify-content: space-between; font-weight: 700; color: #1a9d63; font-size: 1.05em; }
  .merci { text-align: center; color: #999; font-size: 0.8em; margin-top: 14px; }
</style>
</head>
<body>
  <div class="centre">
    <div class="nom-pharmacie">${echapperHtml(d.nomPharmacie)}</div>
    <div class="meta">Recu ${echapperHtml(d.numero)}</div>
    <div class="meta">${echapperHtml(d.date)}</div>
  </div>
  <hr />
  ${lignesHtml}
  <hr />
  <div class="total"><span>Total</span><span>${echapperHtml(formatMontant(d.montantTotal))}</span></div>
  ${paiementsHtml}
  ${monnaieHtml}
  ${creditHtml}
  <div class="merci">Merci de votre confiance !</div>
</body>
</html>`

  const fenetre = window.open('', '_blank', 'width=420,height=640')
  if (!fenetre) {
    throw new Error('POPUP_BLOQUE')
  }
  fenetre.document.open()
  fenetre.document.write(html)
  fenetre.document.close()

  const declencherImpression = () => {
    fenetre.focus()
    fenetre.print()
  }
  if (fenetre.document.readyState === 'complete') {
    setTimeout(declencherImpression, 150)
  } else {
    fenetre.onload = () => setTimeout(declencherImpression, 150)
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