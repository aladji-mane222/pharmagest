import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiError, apiSuccess } from '@/lib/utils'
import { getMedicamentsVendusRecemment } from '@/lib/stock'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return apiError('Non autorise', 401)

  const pharmacieId = session.user.pharmacieId
  const dans90Jours = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)

  const [medicamentsRaw, medicamentsVendusRecemment] = await Promise.all([
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
    // Extrait dans src/lib/stock.ts (Phase 4) pour etre reutilise tel
    // quel par /api/rapports sans dupliquer/risquer de diverger.
    getMedicamentsVendusRecemment(pharmacieId),
  ])

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
    // "rupture" distingue le stock a 0 du simple "stock bas" (sous le
    // seuil mais pas nul) — ajoute pour la Phase 3.7 (sections separees
    // sur /stock), sans toucher a la definition de stockBas ci-dessous,
    // deja utilisee ailleurs (dashboard, alertes cron, /medicaments) et
    // volontairement laissee inchangee pour ne rien casser.
    const rupture = stockTotal === 0
    return { ...m, stockTotal, lotsCritiques, stockBas: stockTotal < m.stockMinimum, produitDormant, rupture }
  })

  const valeurTotale = stock.reduce((sum, m) => sum + (m.stockTotal * (m.prixAchat || 0)), 0)
  const nbProduitsDormants = stock.filter((m) => m.produitDormant).length

  return apiSuccess({ stock, valeurTotale, nbProduitsDormants })
}