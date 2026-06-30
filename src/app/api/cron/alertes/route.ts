import { prisma } from '@/lib/prisma'
import { apiError, apiSuccess } from '@/lib/utils'
import { envoyerEmail, templateAlertStock } from '@/lib/email'
import { envoyerRelancesCredit, TypeRelance } from '@/lib/cron/relances'

export async function GET(request: Request) {
  // ── Auth CRON_SECRET (pas de session NextAuth — cron Vercel automatique) ──
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return apiError('Non autorisé', 401)
  }

  const pharmacies = await prisma.pharmacie.findMany({
    where: { licenceActive: true },
  })

  const now          = new Date()
  const dans90Jours  = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000)

  // Compteurs agrégés toutes pharmacies
  let totalStockBas      = 0
  let totalPeremptions   = 0
  let totalEmailsEnvoyes = 0
  const relancesParType: Record<TypeRelance, number> = { J3: 0, J7: 0, J14: 0 }
  let totalRelances      = 0

  for (const pharmacie of pharmacies) {

    // ── 1. Alertes stock bas ─────────────────────────────────────────────────
    const medicaments = await prisma.medicament.findMany({
      where:   { pharmacieId: pharmacie.id, actif: true },
      include: { lots: { where: { actif: true } } },
    })

    const stockBas = medicaments
      .filter((med) => {
        const total = med.lots.reduce((s, l) => s + l.quantite, 0)
        return total < med.stockMinimum
      })
      .map((med) => ({
        nom:     med.nom,
        stock:   med.lots.reduce((s, l) => s + l.quantite, 0),
        minimum: med.stockMinimum,
      }))

    // ── 2. Lots proches de péremption (< 90 jours) ──────────────────────────
    const lotsExpirant = await prisma.lot.findMany({
      where: {
        actif:          true,
        datePeremption: { gte: now, lte: dans90Jours },
        medicament:     { pharmacieId: pharmacie.id },
      },
      include: { medicament: { select: { nom: true } } },
    })

    // ── 3. Email d'alerte stock (pharmacie.email ou EMAIL_ADMIN global) ──────
    const emailDest = pharmacie.email ?? process.env.EMAIL_ADMIN
    if (stockBas.length > 0 && emailDest) {
      await envoyerEmail({
        to:      emailDest,
        subject: `PharmaGest — ${stockBas.length} médicament(s) en stock bas [${pharmacie.nom}]`,
        html:    templateAlertStock(stockBas),
      })
      totalEmailsEnvoyes++
    }

    // ── 4. Relances crédit WhatsApp ──────────────────────────────────────────
    const relances = await envoyerRelancesCredit(pharmacie.id)
    for (const r of relances) {
      relancesParType[r.type]++
    }
    totalRelances += relances.length

    // ── 5. Accumulation ──────────────────────────────────────────────────────
    totalStockBas    += stockBas.length
    totalPeremptions += lotsExpirant.length
  }

  return apiSuccess({
    pharmaciesTraitees: pharmacies.length,
    stockBas:           totalStockBas,
    peremptions:        totalPeremptions,
    emailsEnvoyes:      totalEmailsEnvoyes,
    relances: {
      total:   totalRelances,
      parType: relancesParType,
    },
  })
}
