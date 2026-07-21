
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiError, apiSuccess } from '@/lib/utils'
import { createAuditLog } from '@/lib/audit'

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return apiError('Non autorise', 401)
  if (session.user.role === 'CAISSIER') return apiError('Acces refuse', 403)

  const pharmacieId = session.user.pharmacieId

  const vente = await prisma.vente.findFirst({
    where: { id: params.id, pharmacieId },
    include: {
      lignes: { include: { medicament: true } },
      client: true,
    },
  })

  if (!vente) return apiError('Vente non trouvee', 404)
  if (vente.statut === 'ANNULEE') return apiError('Vente deja annulee', 400)

  const body = await request.json().catch(() => ({}))
  const { motif } = body

  // resteADu : part mise en crédit client lors de la vente (non stocké, calculé)
  const resteADu = Math.max(0, vente.montantTotal - vente.montantPaye)

  const venteAnnulee = await prisma.$transaction(async (tx) => {
    // a. Marquer la vente annulée
    const v = await tx.vente.update({
      where: { id: params.id },
      data: { statut: 'ANNULEE', motifAnnulation: motif || null },
    })

    // b. Remise en stock pour chaque ligne — un SEUL lot credite, jamais
    // tous les lots actifs du medicament.
    //
    // BUG CORRIGE le 21/07/2026 : l'ancien code faisait
    // `tx.lot.updateMany({ where: { medicamentId, actif: true }, data: {
    // quantite: { increment: ligne.quantite } } })` — `updateMany`
    // applique l'increment a CHAQUE ligne qui matche le where, pas a une
    // seule. Avec 2 lots actifs pour le meme medicament, la quantite
    // rendue etait donc doublee (creditee sur les deux lots a la fois),
    // avec 3 lots elle aurait ete triplee, etc. Trouve en testant
    // reellement une annulation avec plusieurs lots.
    //
    // Le lot cible est, dans l'ordre de preference :
    //  1. Le lot exact d'ou la vente avait ete decrementee (LigneVente.lotId,
    //     rempli par decrementerLotFifo au moment de la vente)
    //  2. A defaut (lotId absent, ventes anciennes), le lot FIFO actif le
    //     plus pertinent (meme regle que getLotFifo utilise a la vente)
    //  3. A defaut absolu (aucun lot actif restant), le lot le plus recent
    //     du medicament, reactive au passage — pour ne jamais perdre le
    //     stock rendu meme dans ce cas limite
    //
    // Limite connue et acceptee : si la vente d'origine avait ete
    // decrementee sur PLUSIEURS lots a la fois (decrementerLotFifo peut
    // scinder une seule ligne de vente entre plusieurs lots quand le
    // premier n'a pas assez de stock), on ne peut pas reconstituer cette
    // repartition exacte car LigneVente ne stocke qu'un seul lotId — la
    // quantite totale rendue reste juste (aucune perte ni doublon), mais
    // peut atterrir sur un seul lot plutot que d'etre repartie exactement
    // comme au depart. Corriger ça precisement demanderait de tracer
    // chaque decrementation individuellement (nouvelle table), hors
    // perimetre de ce correctif.
    for (const ligne of vente.lignes) {
      await tx.mouvementStock.create({
        data: {
          type: 'RETOUR',
          quantite: ligne.quantite,
          medicamentId: ligne.medicamentId,
          userId: session.user.id,
          venteId: params.id,
        },
      })

      let lotCible = ligne.lotId
        ? await tx.lot.findUnique({ where: { id: ligne.lotId } })
        : null

      if (!lotCible) {
        lotCible = await tx.lot.findFirst({
          where: { medicamentId: ligne.medicamentId, actif: true, medicament: { pharmacieId } },
          orderBy: { datePeremption: 'asc' },
        })
      }

      if (!lotCible) {
        lotCible = await tx.lot.findFirst({
          where: { medicamentId: ligne.medicamentId, medicament: { pharmacieId } },
          orderBy: { createdAt: 'desc' },
        })
      }

      if (lotCible) {
        await tx.lot.update({
          where: { id: lotCible.id },
          data: { quantite: { increment: ligne.quantite }, actif: true },
        })
      } else {
        // Aucun lot du tout pour ce medicament (cas limite improbable) —
        // on ne bloque pas l'annulation pour autant, juste un signalement.
        console.warn(`Annulation vente ${params.id} : aucun lot trouve pour recrediter ${ligne.medicamentId}`)
      }
    }

    // c. Décrémenter le solde crédit si la vente était à crédit
    if (vente.clientId && resteADu > 0) {
      await tx.client.update({
        where: { id: vente.clientId },
        data: { soldeCredit: { decrement: resteADu } },
      })
    }

    return v
  })

  await createAuditLog({
    action: 'VENTE_ANNULEE',
    details: {
      numeroFacture: vente.numeroFacture,
      clientNom: vente.client?.nom,
      lignes: vente.lignes.length,
      montantTotal: vente.montantTotal,
      ...(motif && { motif }),
    },
    userId: session.user.id,
    pharmacieId,
  })

  return apiSuccess(venteAnnulee)
}