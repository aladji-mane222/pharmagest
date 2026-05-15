import { prisma } from '@/lib/prisma'

export async function getLotFifo(medicamentId: string, pharmacieId: string, tx?: any) {
  const p = tx || prisma
  const lot = await p.lot.findFirst({
    where: {
      medicamentId,
      actif: true,
      quantite: { gt: 0 },
      medicament: { pharmacieId },
    },
    orderBy: { datePeremption: 'asc' },
  })
  return lot
}

export async function decrementerLotFifo(
  medicamentId: string,
  pharmacieId: string,
  quantite: number,
  tx?: any
) {
  const p = tx || prisma
  let quantiteRestante = quantite

  const lots = await p.lot.findMany({
    where: {
      medicamentId,
      actif: true,
      quantite: { gt: 0 },
      medicament: { pharmacieId },
    },
    orderBy: { datePeremption: 'asc' },
  })

  for (const lot of lots) {
    if (quantiteRestante <= 0) break

    const aDeduire = Math.min(lot.quantite, quantiteRestante)
    const nouvelleQuantite = lot.quantite - aDeduire

    await p.lot.update({
      where: { id: lot.id },
      data: {
        quantite: nouvelleQuantite,
        actif: nouvelleQuantite > 0,
      },
    })

    quantiteRestante -= aDeduire
  }

  return quantiteRestante === 0
}
