import { prisma } from '@/lib/prisma'

// ── Types ────────────────────────────────────────────────────────────────────

export type TypeRelance = 'J3' | 'J7' | 'J14'

export interface Relance {
  clientId:     string
  clientNom:    string
  telephone:    string
  montantDu:    number
  pharmacieNom: string
  jourDepuis:   number
  type:         TypeRelance
  message:      string
  lienWhatsApp: string
}

// ── Formatage numéro WhatsApp ─────────────────────────────────────────────────
// Normalise vers le format international sans + (ex: 224620123456)
function normaliserTelephone(telephone: string): string {
  // Supprime espaces, tirets, points, parenthèses
  const net = telephone.replace(/[\s\-\.\(\)]/g, '')

  if (net.startsWith('00')) return net.slice(2)      // 00224... → 224...
  if (net.startsWith('+'))  return net.slice(1)      // +224...  → 224...
  if (net.startsWith('0'))  return '224' + net.slice(1) // 0620...  → 224620...
  // Si déjà 9 chiffres (local guinéen sans indicatif) : ajouter 224
  if (/^\d{9}$/.test(net)) return '224' + net
  return net
}

function genererLien(telephone: string, message: string): string {
  return `https://wa.me/${normaliserTelephone(telephone)}?text=${encodeURIComponent(message)}`
}

// ── Messages par type de relance ─────────────────────────────────────────────
function genererMessage(
  type: TypeRelance,
  clientNom: string,
  montantDu: number,
  pharmacieNom: string,
  jourDepuis: number
): string {
  const montant = new Intl.NumberFormat('fr-FR').format(montantDu)

  switch (type) {
    case 'J3':
      return (
        `Bonjour ${clientNom}, nous vous rappelons que vous avez un solde ` +
        `de ${montant} GNF auprès de la pharmacie ${pharmacieNom}. ` +
        `Merci de régulariser à votre prochaine visite. 🙏`
      )
    case 'J7':
      return (
        `Bonjour ${clientNom}, votre solde de ${montant} GNF à la pharmacie ` +
        `${pharmacieNom} est impayé depuis ${jourDepuis} jours. ` +
        `Merci de vous en acquitter rapidement.`
      )
    case 'J14':
      return (
        `Bonjour ${clientNom}, nous vous contactons pour votre solde de ` +
        `${montant} GNF impayé depuis ${jourDepuis} jours à la pharmacie ` +
        `${pharmacieNom}. Veuillez nous contacter pour régulariser votre situation.`
      )
  }
}

// ── Fonction principale ───────────────────────────────────────────────────────
/**
 * Génère les relances WhatsApp pour les clients en crédit.
 * - pharmacieId facultatif : si absent, traite toutes les pharmacies.
 * - Seuil de déclenchement : solde > 0 ET dernière vente PARTIELLE ≥ 3 jours.
 * - Logique J+3 / J+7 / J+14 basée sur la date de la dernière vente PARTIELLE.
 * - Retourne les liens à envoyer manuellement (WhatsApp n'a pas d'API gratuite).
 */
export async function envoyerRelancesCredit(pharmacieId?: string): Promise<Relance[]> {
  const clients = await prisma.client.findMany({
    where: {
      actif:       true,
      soldeCredit: { gt: 0 },
      telephone:   { not: null },
      ...(pharmacieId ? { pharmacieId } : {}),
    },
    include: {
      pharmacie: { select: { nom: true } },
      ventes: {
        where:   { statut: 'PARTIELLE' },
        orderBy: { createdAt: 'desc' },
        take:    1,
        select:  { createdAt: true },
      },
    },
    orderBy: { soldeCredit: 'desc' },
  })

  const maintenant  = new Date()
  const relances: Relance[] = []

  for (const client of clients) {
    // telephone est String? — on a filtré not:null mais TS l'ignore
    if (!client.telephone) continue

    // Référence : date de la dernière vente PARTIELLE, ou date d'inscription si aucune
    const dateRef = client.ventes[0]?.createdAt ?? client.createdAt
    const jourDepuis = Math.floor(
      (maintenant.getTime() - dateRef.getTime()) / (1000 * 60 * 60 * 24)
    )

    // Pas de relance avant J+3 (achat trop récent)
    if (jourDepuis < 3) continue

    // Type de relance selon l'ancienneté du crédit
    let type: TypeRelance
    if (jourDepuis < 7)  type = 'J3'
    else if (jourDepuis < 14) type = 'J7'
    else                 type = 'J14'

    const message = genererMessage(
      type,
      client.nom,
      client.soldeCredit,
      client.pharmacie.nom,
      jourDepuis
    )

    relances.push({
      clientId:     client.id,
      clientNom:    client.nom,
      telephone:    client.telephone,
      montantDu:    client.soldeCredit,
      pharmacieNom: client.pharmacie.nom,
      jourDepuis,
      type,
      message,
      lienWhatsApp: genererLien(client.telephone, message),
    })
  }

  return relances
}
