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
 * IMPORTANT — comportement "fail open" (ajoute le 10/07/2026) :
 * Les ports Postgres (5432/6543) sont bloques de facon intermittente par
 * les operateurs reseau en Guinee (contrainte documentee du projet), donc
 * la base peut devenir injoignable a tout moment, y compris pendant une
 * tentative de connexion legitime. Si verifierRateLimit/enregistrerEchec/
 * reinitialiser echouent a cause d'une panne reseau ou base, on AUTORISE
 * la tentative plutot que de la bloquer : le mot de passe sera quand meme
 * verifie normalement juste apres dans authorize(). Un rate limiting qui
 * bloque tout le monde des que la base a un probleme serait pire que
 * l'absence de rate limiting — la disponibilite d'un acces legitime prime
 * sur la protection anti brute-force dans ce cas precis.
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
 *
 * En cas d'erreur base/reseau : autorise par defaut (voir note "fail open"
 * en tete de fichier).
 */
export async function verifierRateLimit(
  cle: string
): Promise<{ autorise: boolean; reessayerDansMs?: number }> {
  try {
    const maintenant = Date.now()
    const depuis = new Date(maintenant - FENETRE_MS)

    await prisma.tentativeConnexion.deleteMany({
      where: { cle, createdAt: { lt: depuis } },
    })

    const tentativesRecentes = await prisma.tentativeConnexion.findMany({
      where: { cle, createdAt: { gte: depuis } },
      orderBy: { createdAt: 'asc' },
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
  } catch (error) {
    console.error(
      '[rate-limit] Verification impossible (base injoignable) — tentative autorisee par defaut pour ne pas bloquer une connexion legitime :',
      error
    )
    return { autorise: true }
  }
}

/**
 * Enregistre une tentative echouee pour la cle donnee.
 * A appeler uniquement en cas d'echec d'authentification (pas sur un succes).
 * Echec silencieux (log seulement) si la base est injoignable — ce n'est
 * qu'un compteur de securite, pas une operation critique pour l'utilisateur.
 */
export async function enregistrerEchec(cle: string): Promise<void> {
  try {
    await prisma.tentativeConnexion.create({ data: { cle } })
  } catch (error) {
    console.error('[rate-limit] Impossible d\'enregistrer la tentative echouee (base injoignable) :', error)
  }
}

/**
 * Reinitialise le compteur pour une cle (a appeler sur une connexion reussie).
 * Echec silencieux si la base est injoignable, meme raison qu'au-dessus.
 */
export async function reinitialiser(cle: string): Promise<void> {
  try {
    await prisma.tentativeConnexion.deleteMany({ where: { cle } })
  } catch (error) {
    console.error('[rate-limit] Impossible de reinitialiser le compteur (base injoignable) :', error)
  }
}