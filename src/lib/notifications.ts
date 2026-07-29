import { prisma } from '@/lib/prisma'
import type { TypeNotification } from '@prisma/client'

interface CreerNotificationParams {
  userId: string
  type: TypeNotification
  titre: string
  message: string
  lien?: string
}

export async function creerNotification(params: CreerNotificationParams) {
  return prisma.notification.create({ data: params })
}

/** Fan-out vers tous les ADMIN (+ SUPER_ADMIN rattaches) d'une pharmacie. */
export async function notifierAdmins(
  pharmacieId: string,
  data: { type: TypeNotification; titre: string; message: string; lien?: string },
  exclureUserId?: string
) {
  const admins = await prisma.user.findMany({
    where: {
      pharmacieId,
      role: { in: ['ADMIN', 'SUPER_ADMIN'] },
      actif: true,
      ...(exclureUserId && { id: { not: exclureUserId } }),
    },
    select: { id: true },
  })
  if (admins.length === 0) return
  await prisma.notification.createMany({
    data: admins.map((a) => ({ userId: a.id, ...data })),
  })
}

/** Fan-out vers tous les SUPER_ADMIN (toutes pharmacies confondues). */
export async function notifierSuperAdmins(
  data: { type: TypeNotification; titre: string; message: string; lien?: string }
) {
  const superAdmins = await prisma.user.findMany({
    where: { role: 'SUPER_ADMIN', actif: true },
    select: { id: true },
  })
  if (superAdmins.length === 0) return
  await prisma.notification.createMany({
    data: superAdmins.map((a) => ({ userId: a.id, ...data })),
  })
}

/**
 * Pour les conditions PERIODIQUES verifiees par un cron (stock bas,
 * peremption, session caisse longue, permission qui expire, licence qui
 * expire) — evite de spammer une notification identique a chaque
 * execution du cron tant que la precedente n'a pas ete lue. "cle" doit
 * identifier l'entite concernee de facon stable (ex: medicamentId,
 * lotId, sessionCaisseId) pour permettre la deduplication par simple
 * recherche texte dans le message ou une cle dediee — ici on utilise le
 * lien comme cle de deduplication (unique par entite dans la pratique).
 */
export async function notifierSiPasDejaEnAttente(
  userId: string,
  data: { type: TypeNotification; titre: string; message: string; lien?: string }
) {
  const dejaEnAttente = await prisma.notification.findFirst({
    where: { userId, type: data.type, lien: data.lien, lu: false },
  })
  if (dejaEnAttente) return
  await creerNotification({ userId, ...data })
}

/**
 * Variante dedupliquee de notifierSuperAdmins, pour les conditions
 * periodiques (licence qui expire, backup en echec) — meme logique que
 * notifierSiPasDejaEnAttente mais fan-out vers tous les SUPER_ADMIN.
 * Sans ca, une condition qui reste vraie plusieurs jours de suite (ex:
 * licence expirant dans 30 jours, verifiee chaque jour par le cron)
 * creerait une notification en doublon a chaque execution.
 */
export async function notifierSuperAdminsSiPasDejaEnAttente(
  data: { type: TypeNotification; titre: string; message: string; lien?: string }
) {
  const superAdmins = await prisma.user.findMany({
    where: { role: 'SUPER_ADMIN', actif: true },
    select: { id: true },
  })
  for (const admin of superAdmins) {
    await notifierSiPasDejaEnAttente(admin.id, data)
  }
}
