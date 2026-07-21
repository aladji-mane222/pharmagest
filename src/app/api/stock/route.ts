import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiError, apiSuccess } from '@/lib/utils'
import { Prisma } from '@prisma/client'

// 90 jours : meme convention que le seuil de peremption proche et la
// fenetre de fiabilite fournisseur deja utilises ailleurs dans l'app —
// pour ne pas ajouter un nouveau chiffre "magique" de plus.
const FENETRE_DORMANT_JOURS = 90

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return apiError('Non autorise', 401)

  const pharmacieId = session.user.pharmacieId
  const dans90Jours = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)

  const [medicamentsRaw, ventesRecentes] = await Promise.all([
    prisma.medicament.findMany({
      where: { pharmacieId, actif: true },
      include: {
        lots: {
          where: { actif: true },
          select: { id: true, numeroLot: true, quantite: true, datePeremption: true },
        },
      },
      orderBy: { nom: 'asc' },
    }),
    // Un seul aller-retour pour recuperer tous les medicaments vendus
    // recemment, plutot qu'une requete "derniere vente" par medicament
    // (latence Guinee-Europe deja documentee dans le projet)
    prisma.$queryRaw<{ medicamentId: string }[]>(
      Prisma.sql`
        SELECT DISTINCT lv."medicamentId"
        FROM "LigneVente" lv
        JOIN "Vente" v ON v.id = lv."venteId"
        WHERE v."pharmacieId" = ${pharmacieId}
          AND v.statut != 'ANNULEE'
          AND v."createdAt" >= NOW() - (${FENETRE_DORMANT_JOURS}::int * INTERVAL '1 day')
      `
    ),
  ])
  const medicamentsVendusRecemment = new Set(ventesRecentes.map((v) => v.medicamentId))

  // BUG CRITIQUE corrigé le 04/07/2026 : l'ancien code faisait
  // `medicamentsRaw.map(({ lots, ...m }) => ...)`, ce qui retirait "lots"
  // de l'objet via la déstructuration et ne le renvoyait JAMAIS au frontend.
  // La page /stock plantait ("Application error: a client-side exception")
  // dès qu'on cliquait sur un médicament, car `selected.lots.map(...)`
  // s'exécutait sur `undefined`. Le select des lots ne renvoyait pas non
  // plus `id`/`numeroLot`, pourtant affichés dans le panneau détail.
  //
  // Produits dormants (Phase 3.6, 20/07/2026) : stock present mais
  // aucune vente sur la fenetre de 90 jours.
  const stock = medicamentsRaw.map((m) => {
    const stockTotal = m.lots.reduce((sum, l) => sum + l.quantite, 0)
    const lotsCritiques = m.lots.filter(l => l.datePeremption <= dans90Jours).length
    const produitDormant = stockTotal > 0 && !medicamentsVendusRecemment.has(m.id)
    return { ...m, stockTotal, lotsCritiques, stockBas: stockTotal < m.stockMinimum, produitDormant }
  })

  const valeurTotale = stock.reduce((sum, m) => sum + (m.stockTotal * (m.prixAchat || 0)), 0)
  const nbProduitsDormants = stock.filter((m) => m.produitDormant).length

  return apiSuccess({ stock, valeurTotale, nbProduitsDormants })
}