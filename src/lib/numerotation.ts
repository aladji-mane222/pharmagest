import { Prisma } from '@prisma/client'

/**
 * Fonctions de generation de numeros sequentiels, par pharmacie (jamais
 * globalement — chaque pharmacie a sa propre numerotation, sinon deux
 * pharmacies clientes se marcheraient dessus).
 *
 * IMPORTANT — a appeler UNIQUEMENT a l'interieur de la meme transaction
 * Prisma ($transaction) qui cree l'enregistrement final. Le calcul
 * "MAX + 1" n'est fiable contre les collisions concurrentes que si la
 * lecture et l'ecriture se font dans la meme transaction — sinon deux
 * creations simultanees pourraient lire le meme MAX et se retrouver avec
 * le meme numero. C'est l'approche documentee dans le plan de
 * consolidation (§2BIS) plutot qu'un auto-increment SQL classique, pour
 * respecter le multi-tenant (compteur par pharmacieId, pas global).
 *
 * Deux familles de numeros, avec une logique differente (decide le
 * 13/07/2026) :
 * - FACTURE et COMMANDE sont des documents lies a un instant precis —
 *   inclure l'annee et repartir a 1 chaque annee est une pratique
 *   comptable standard. Stockes directement sous leur forme finale
 *   ("FAC-2026-0142") car ce sont des references qui peuvent deja avoir
 *   ete imprimees/communiquees — on ne les reformate jamais a l'affichage.
 * - CLIENT et FOURNISSEUR sont des identifiants permanents — l'annee ne
 *   doit JAMAIS y figurer, sinon deux clients d'annees differentes
 *   pourraient afficher le meme numero apparent. Stockes en base comme
 *   simple entier (tri, unicite faciles), le prefixe "CLI-"/"FOU-" est
 *   ajoute uniquement a l'affichage via les fonctions formaterNumero*.
 */

/** Numero de facture, format "FAC-AAAA-NNNN". Ex: "FAC-2026-0142". */
export async function genererNumeroFacture(
  tx: Prisma.TransactionClient,
  pharmacieId: string
): Promise<string> {
  const annee = new Date().getFullYear()
  const prefixe = `FAC-${annee}-`

  const derniere = await tx.vente.findFirst({
    where: { pharmacieId, numeroFacture: { startsWith: prefixe } },
    orderBy: { numeroFacture: 'desc' },
    select: { numeroFacture: true },
  })

  const dernierNumero = derniere?.numeroFacture
    ? parseInt(derniere.numeroFacture.slice(prefixe.length), 10)
    : 0

  const prochain = (Number.isNaN(dernierNumero) ? 0 : dernierNumero) + 1
  return `${prefixe}${String(prochain).padStart(4, '0')}`
}

/** Numero de commande fournisseur, format "CMD-AAAA-NNNN". Ex: "CMD-2026-0058". */
export async function genererNumeroCommande(
  tx: Prisma.TransactionClient,
  pharmacieId: string
): Promise<string> {
  const annee = new Date().getFullYear()
  const prefixe = `CMD-${annee}-`

  const derniere = await tx.commandeFournisseur.findFirst({
    where: { pharmacieId, numeroCommande: { startsWith: prefixe } },
    orderBy: { numeroCommande: 'desc' },
    select: { numeroCommande: true },
  })

  const dernierNumero = derniere?.numeroCommande
    ? parseInt(derniere.numeroCommande.slice(prefixe.length), 10)
    : 0

  const prochain = (Number.isNaN(dernierNumero) ? 0 : dernierNumero) + 1
  return `${prefixe}${String(prochain).padStart(4, '0')}`
}

/** Numero client sequentiel PERMANENT (jamais d'annee), stocke en base comme entier. */
export async function genererNumeroClient(
  tx: Prisma.TransactionClient,
  pharmacieId: string
): Promise<number> {
  const max = await tx.client.aggregate({
    where: { pharmacieId },
    _max: { numeroClient: true },
  })
  return (max._max.numeroClient || 0) + 1
}

/** Numero fournisseur sequentiel PERMANENT (jamais d'annee), stocke en base comme entier. */
export async function genererNumeroFournisseur(
  tx: Prisma.TransactionClient,
  pharmacieId: string
): Promise<number> {
  const max = await tx.fournisseur.aggregate({
    where: { pharmacieId },
    _max: { numeroFournisseur: true },
  })
  return (max._max.numeroFournisseur || 0) + 1
}

/**
 * Formate un numero client entier pour l'affichage : "CLI-0001".
 * Retourne null si le client n'a pas encore de numero (cree avant
 * l'ajout de cette fonctionnalite).
 */
export function formaterNumeroClient(numero: number | null | undefined): string | null {
  if (numero === null || numero === undefined) return null
  return `CLI-${String(numero).padStart(4, '0')}`
}

/** Formate un numero fournisseur entier pour l'affichage : "FOU-0001". */
export function formaterNumeroFournisseur(numero: number | null | undefined): string | null {
  if (numero === null || numero === undefined) return null
  return `FOU-${String(numero).padStart(4, '0')}`
}