// Extrait le 06/08/2026 (Phase 6BIS-A.2) du cron d'alertes pour etre
// appelable aussi depuis la creation de vente — le cron ne tournant
// qu'une fois par jour a 7h, une session ouverte a 9h et deja trop
// longue a 17h ne notifiait personne avant le lendemain (bug confirme
// en audit le 05/08/2026). En centralisant la logique ici, le cron
// reste un filet de securite quotidien et la creation de vente devient
// le declencheur reactif principal — meme regle des deux cotes, pas de
// divergence possible (principe "lib partagee" du projet).

import { prisma } from '@/lib/prisma'
import { notifierSiPasDejaEnAttente } from '@/lib/notifications'

/**
 * Verifie si UNE session de caisse precise depasse le seuil configure
 * pour sa pharmacie, et notifie si besoin — les admins ET le caissier
 * concerne (avant le 06/08/2026, seuls les admins etaient notifies).
 * Ne fait rien si la pharmacie n'a pas de seuil configure, si la
 * session est deja fermee, ou si le seuil n'est pas encore atteint.
 */
export async function verifierSessionCaisseLongue(sessionCaisseId: string): Promise<void> {
  const sessionCaisse = await prisma.sessionCaisse.findUnique({
    where: { id: sessionCaisseId },
    select: {
      id: true,
      dateOuverture: true,
      dateCloture: true,
      actif: true,
      userId: true,
      pharmacieId: true,
      user: { select: { nom: true } },
    },
  })
  if (!sessionCaisse || sessionCaisse.dateCloture || !sessionCaisse.actif) return

  const pharmacie = await prisma.pharmacie.findUnique({
    where: { id: sessionCaisse.pharmacieId },
    select: { dureeMaxSessionCaisseH: true },
  })
  if (!pharmacie?.dureeMaxSessionCaisseH) return

  const dureeHeures =
    (Date.now() - sessionCaisse.dateOuverture.getTime()) / (1000 * 60 * 60)
  if (dureeHeures < pharmacie.dureeMaxSessionCaisseH) return

  // lien inclut l'id de session : sans ca, 2 sessions longues distinctes
  // le meme jour se bloqueraient mutuellement via la dedup (qui compare
  // userId+type+lien) — trouve en audit le 30/07/2026, comportement
  // conserve ici a l'identique.
  const lien = `/caisse?session=${sessionCaisse.id}`

  const admins = await prisma.user.findMany({
    where: { pharmacieId: sessionCaisse.pharmacieId, role: { in: ['ADMIN', 'SUPER_ADMIN'] }, actif: true },
    select: { id: true },
  })
  for (const admin of admins) {
    await notifierSiPasDejaEnAttente(admin.id, {
      type: 'SESSION_CAISSE_LONGUE',
      titre: 'Session de caisse ouverte trop longtemps',
      message: `La session de ${sessionCaisse.user.nom} est ouverte depuis plus de ${pharmacie.dureeMaxSessionCaisseH}h`,
      lien,
    })
  }

  // Nouveau 06/08/2026 : le caissier concerne est notifie lui aussi, pas
  // seulement les admins — c'est lui qui est en mesure de fermer la
  // session, un admin absent de la pharmacie ne peut rien faire de la
  // notification seule.
  await notifierSiPasDejaEnAttente(sessionCaisse.userId, {
    type: 'SESSION_CAISSE_LONGUE',
    titre: 'Ta session de caisse est ouverte depuis longtemps',
    message: `Ta session est ouverte depuis plus de ${pharmacie.dureeMaxSessionCaisseH}h — pense a la fermer si ta journee de travail est terminee.`,
    lien,
  })
}

/**
 * Variante "toutes les sessions ouvertes d'une pharmacie" — utilisee par
 * le cron quotidien, qui doit balayer toutes les sessions actives plutot
 * que d'en verifier une seule comme le fait le declencheur reactif.
 */
export async function verifierSessionsCaisseLonguesPharmacie(pharmacieId: string): Promise<void> {
  const sessions = await prisma.sessionCaisse.findMany({
    where: { pharmacieId, dateCloture: null, actif: true },
    select: { id: true },
  })
  for (const s of sessions) {
    await verifierSessionCaisseLongue(s.id)
  }
}
