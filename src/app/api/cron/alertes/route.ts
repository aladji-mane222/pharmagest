import { prisma } from '@/lib/prisma'
import { apiError, apiSuccess } from '@/lib/utils'
import { envoyerEmail, templateAlertStock } from '@/lib/email'
import { envoyerRelancesCredit, TypeRelance } from '@/lib/cron/relances'
import { notifierSiPasDejaEnAttente, notifierSuperAdminsSiPasDejaEnAttente } from '@/lib/notifications'

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

    // ── 5. Notifications internes (Phase 6, 28/07/2026) ──────────────────────
    // Une notification AGREGEE par pharmacie/par jour (pas une par
    // medicament/lot) pour eviter de noyer les admins — deduplique via
    // notifierSiPasDejaEnAttente tant que la precedente n'a pas ete lue.
    const adminsPharmacie = await prisma.user.findMany({
      where: { pharmacieId: pharmacie.id, role: { in: ['ADMIN', 'SUPER_ADMIN'] }, actif: true },
      select: { id: true },
    })

    if (stockBas.length > 0) {
      for (const admin of adminsPharmacie) {
        await notifierSiPasDejaEnAttente(admin.id, {
          type: 'STOCK_BAS',
          titre: 'Médicaments en stock bas',
          message: `${stockBas.length} médicament${stockBas.length > 1 ? 's' : ''} en stock bas ou en rupture`,
          lien: '/stock',
        })
      }
    }

    if (lotsExpirant.length > 0) {
      for (const admin of adminsPharmacie) {
        await notifierSiPasDejaEnAttente(admin.id, {
          type: 'PEREMPTION_PROCHE',
          titre: 'Péremptions proches',
          message: `${lotsExpirant.length} lot${lotsExpirant.length > 1 ? 's' : ''} arrivant à péremption dans les 90 jours`,
          lien: '/stock',
        })
      }
    }

    // ── 6. Sessions de caisse restées ouvertes trop longtemps ────────────────
    if (pharmacie.dureeMaxSessionCaisseH) {
      const seuil = new Date(now.getTime() - pharmacie.dureeMaxSessionCaisseH * 60 * 60 * 1000)
      const sessionsLongues = await prisma.sessionCaisse.findMany({
        where: { pharmacieId: pharmacie.id, dateCloture: null, actif: true, dateOuverture: { lte: seuil } },
        include: { user: { select: { nom: true } } },
      })
      for (const s of sessionsLongues) {
        for (const admin of adminsPharmacie) {
          await notifierSiPasDejaEnAttente(admin.id, {
            type: 'SESSION_CAISSE_LONGUE',
            titre: 'Session de caisse ouverte trop longtemps',
            message: `La session de ${s.user.nom} est ouverte depuis plus de ${pharmacie.dureeMaxSessionCaisseH}h`,
            lien: '/caisse',
          })
        }
      }
    }

    // ── 7. Permissions supplementaires expirant sous 3 jours ─────────────────
    const dans3Jours = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000)
    const permissionsExpirantBientot = await prisma.permissionSupplementaire.findMany({
      where: {
        user: { pharmacieId: pharmacie.id },
        expireLe: { gte: now, lte: dans3Jours },
      },
    })
    for (const p of permissionsExpirantBientot) {
      await notifierSiPasDejaEnAttente(p.userId, {
        type: 'PERMISSION_EXPIRE_BIENTOT',
        titre: 'Un de tes droits expire bientôt',
        message: `Ton droit "${p.type}" expire le ${p.expireLe!.toLocaleDateString('fr-FR')}`,
        lien: '/profil',
      })
    }

    // ── 8. Accumulation ──────────────────────────────────────────────────────
    totalStockBas    += stockBas.length
    totalPeremptions += lotsExpirant.length
  }

  // ── 9. Licences pharmacie proches de l'expiration (SUPER_ADMIN) ───────────
  const dans30Jours = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
  const pharmaciesLicenceExpirante = await prisma.pharmacie.findMany({
    where: { licenceExpire: { gte: now, lte: dans30Jours } },
  })
  for (const p of pharmaciesLicenceExpirante) {
    await notifierSuperAdminsSiPasDejaEnAttente({
      type: 'LICENCE_EXPIRE_BIENTOT',
      titre: 'Licence bientôt expirée',
      message: `La licence de ${p.nom} expire le ${p.licenceExpire!.toLocaleDateString('fr-FR')}`,
      lien: '/superadmin',
    })
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
