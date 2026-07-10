/**
 * Rate limiting des tentatives de connexion, stocke en base (table
 * TentativeConnexion) plutot qu'en memoire du process.
 *
 * Pourquoi en base et pas en memoire :
 * - En "next dev", le module peut etre reevalue entre les requetes, ce qui
 *   viderait un compteur en memoire (constate par un test reel le 09/07/2026 :
 *   le compteur ne survivait pas d'une tentative a l'autre).
 * - En production sur Vercel, chaque requete peut atterrir sur une instance
 *   serverless differente avec sa propre memoire : un compteur en memoire
 *   ne protege donc pas reellement contre le brute-force en prod.
 * - La base Supabase est le seul etat partage fiable entre toutes les
 *   instances, en dev comme en prod.
 *
 * Fenetre glissante simple : 5 tentatives echouees / 5 minutes / cle (email+IP).
 */
import { prisma } from '@/lib/prisma'

const FENETRE_MS = 5 * 60 * 1000 // 5 minutes
const MAX_TENTATIVES = 5

/**
 * Verifie si une cle (ex: `email:ip`) a depasse le quota de tentatives.
 * Retourne { autorise: false, reessayerDansMs } si bloque.
 *
 * Purge au passage les tentatives de cette cle plus vieilles que la fenetre,
 * pour eviter d'accumuler des lignes indefiniment sans avoir besoin d'un
 * cron dedie (le volume par cle est faible, cette purge est bon marche).
 */
export async function verifierRateLimit(
  cle: string
): Promise<{ autorise: boolean; reessayerDansMs?: number }> {
  const maintenant = Date.now()
  const depuis = new Date(maintenant - FENETRE_MS)

  await prisma.tentativeConnexion.deleteMany({
    where: { cle, createdAt: { lt: depuis } },
  })

  const tentativesRecentes = await prisma.tentativeConnexion.findMany({
    where: { cle, createdAt: { gte: depuis } },
    orderBy: { createdAt: 'asc' },
  })

  // DEBUG TEMPORAIRE — a retirer une fois le rate limiting confirme fonctionnel
  console.log('[rate-limit] verifierRateLimit', {
    cle,
    maintenant: new Date(maintenant).toISOString(),
    depuis: depuis.toISOString(),
    nbTrouvees: tentativesRecentes.length,
    createdAtTrouvees: tentativesRecentes.map((t) => t.createdAt.toISOString()),
  })

  if (tentativesRecentes.length < MAX_TENTATIVES) {
    return { autorise: true }
  }

  const premiere = tentativesRecentes[0]
  const reessayerDansMs = Math.max(
    FENETRE_MS - (maintenant - premiere.createdAt.getTime()),
    0
  )
  return { autorise: false, reessayerDansMs }
}

/**
 * Enregistre une tentative echouee pour la cle donnee.
 * A appeler uniquement en cas d'echec d'authentification (pas sur un succes).
 */
export async function enregistrerEchec(cle: string): Promise<void> {
  const ligne = await prisma.tentativeConnexion.create({ data: { cle } })
  // DEBUG TEMPORAIRE — a retirer une fois le rate limiting confirme fonctionnel
  console.log('[rate-limit] enregistrerEchec - ligne creee', {
    id: ligne.id,
    cle: ligne.cle,
    createdAt: ligne.createdAt.toISOString(),
  })
}

/**
 * Reinitialise le compteur pour une cle (a appeler sur une connexion reussie).
 */
export async function reinitialiser(cle: string): Promise<void> {
  await prisma.tentativeConnexion.deleteMany({ where: { cle } })
}