import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiError, apiSuccess } from '@/lib/utils'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return apiError('Non autorise', 401)

  const pharmacieId = session.user.pharmacieId
  const dans90Jours = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)

  const medicamentsRaw = await prisma.medicament.findMany({
    where: { pharmacieId, actif: true },
    include: {
      lots: {
        where: { actif: true },
        select: { id: true, numeroLot: true, quantite: true, datePeremption: true },
      },
    },
    orderBy: { nom: 'asc' },
  })

  // BUG CRITIQUE corrigé le 04/07/2026 : l'ancien code faisait
  // `medicamentsRaw.map(({ lots, ...m }) => ...)`, ce qui retirait "lots"
  // de l'objet via la déstructuration et ne le renvoyait JAMAIS au frontend.
  // La page /stock plantait ("Application error: a client-side exception")
  // dès qu'on cliquait sur un médicament, car `selected.lots.map(...)`
  // s'exécutait sur `undefined`. Le select des lots ne renvoyait pas non
  // plus `id`/`numeroLot`, pourtant affichés dans le panneau détail.
  const stock = medicamentsRaw.map((m) => {
    const stockTotal = m.lots.reduce((sum, l) => sum + l.quantite, 0)
    const lotsCritiques = m.lots.filter(l => l.datePeremption <= dans90Jours).length
    return { ...m, stockTotal, lotsCritiques, stockBas: stockTotal < m.stockMinimum }
  })

  const valeurTotale = stock.reduce((sum, m) => sum + (m.stockTotal * (m.prixAchat || 0)), 0)

  return apiSuccess({ stock, valeurTotale })
}
