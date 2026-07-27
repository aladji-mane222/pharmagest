import { prisma } from '@/lib/prisma'
import type { TypePermission } from '@prisma/client'

/**
 * Verifie si un utilisateur a une permission supplementaire ACTIVE
 * (accordee et non expiree). Toujours verifie cote serveur au moment de
 * l'action (jamais uniquement via le JWT, qui peut etre legerement en
 * retard apres une revocation) — source de verite unique.
 */
export async function aLaPermission(userId: string, type: TypePermission): Promise<boolean> {
  const permission = await prisma.permissionSupplementaire.findUnique({
    where: { userId_type: { userId, type } },
  })
  if (!permission) return false
  if (permission.expireLe && permission.expireLe < new Date()) return false
  return true
}

/**
 * Liste les types de permissions actives d'un utilisateur — utilise au
 * moment de la connexion pour les embarquer dans le JWT (evite un aller-
 * retour DB a chaque requete juste pour la navigation/middleware). Les
 * routes API, elles, revalidatent toujours en direct via aLaPermission
 * ci-dessus avant d'autoriser une action sensible.
 */
export async function listerPermissionsActives(userId: string): Promise<TypePermission[]> {
  const permissions = await prisma.permissionSupplementaire.findMany({
    where: { userId },
  })
  const maintenant = new Date()
  return permissions
    .filter((p) => !p.expireLe || p.expireLe > maintenant)
    .map((p) => p.type)
}
