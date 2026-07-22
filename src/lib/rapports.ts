import { prisma } from '@/lib/prisma'

// Centralise le calcul CA / CMV / Depenses / Benefice net (Phase 4) pour
// que le rapport "Benefice" et le resume KPI en tete de page ne
// divergent jamais sur la formule — meme principe que lib/livraison.ts
// et lib/stock.ts.
export async function calculerBeneficeNet(pharmacieId: string, debut: Date, fin: Date) {
  const ventesWhere = { pharmacieId, createdAt: { gte: debut, lte: fin }, statut: 'COMPLETE' as const }

  const [ventesAgg, depensesAgg, lignesVente] = await Promise.all([
    prisma.vente.aggregate({ where: ventesWhere, _sum: { montantTotal: true }, _count: true }),
    prisma.depense.aggregate({
      where: { pharmacieId, createdAt: { gte: debut, lte: fin }, archivee: false },
      _sum: { montant: true },
    }),
    // CMV = somme des (prixAchat du médicament × quantité vendue)
    prisma.ligneVente.findMany({
      where: { vente: ventesWhere },
      select: { quantite: true, medicament: { select: { prixAchat: true } } },
    }),
  ])

  const ca            = ventesAgg._sum.montantTotal ?? 0
  const nbVentes       = ventesAgg._count
  const totalDepenses  = depensesAgg._sum.montant ?? 0
  const cmv            = lignesVente.reduce((sum, l) => sum + (l.medicament.prixAchat ?? 0) * l.quantite, 0)
  const beneficeNet    = ca - cmv - totalDepenses
  const panierMoyen    = nbVentes > 0 ? ca / nbVentes : 0

  return { ca, cmv, totalDepenses, beneficeNet, panierMoyen, nbVentes }
}

// evolution en % entre deux valeurs — null si la base de comparaison est
// a 0 (pourcentage infini/trompeur), meme convention que la comparaison
// de periodes du rapport Ventes (Phase 4.2)
export function calculerEvolution(actuel: number, precedent: number): number | null {
  return precedent > 0 ? Math.round(((actuel - precedent) / precedent) * 100) : null
}