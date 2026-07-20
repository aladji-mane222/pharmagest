import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiError, apiSuccess } from '@/lib/utils'
import { createAuditLog } from '@/lib/audit'

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return apiError('Non autorise', 401)

  const commande = await prisma.commandeFournisseur.findFirst({
    where: { id: params.id, pharmacieId: session.user.pharmacieId },
    include: {
      fournisseur: true,
      lignes: {
        include: { medicament: { select: { nom: true } } },
      },
    },
  })

  if (!commande) return apiError('Commande non trouvee', 404)
  return apiSuccess(commande)
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return apiError('Non autorise', 401)
  if (session.user.role === 'CAISSIER') return apiError('Acces refuse', 403)

  const pharmacieId = session.user.pharmacieId
  const userId = session.user.id

  const commande = await prisma.commandeFournisseur.findFirst({
    where: { id: params.id, pharmacieId },
    include: { lignes: true },
  })
  if (!commande) return apiError('Commande non trouvee', 404)

  const body = await request.json()
  const { statut } = body

  if (statut === 'RECUE') {
    if (commande.statut === 'RECUE') return apiError('Commande deja receptionnee', 400)
    if (commande.statut === 'ANNULEE') return apiError('Commande annulee, impossible de receptionner', 400)

    // ─── Reception reelle (remplace le bug ou quantite commandee et une
    // date +365j inventee etaient enregistrees automatiquement) ──────────
    // Le front envoie, pour chaque ligne de la commande, un ou plusieurs
    // "sous-lots" recus (quantite + date de peremption). Plusieurs
    // sous-lots par ligne permettent de couvrir le cas reel ou un
    // fournisseur livre un meme medicament avec des dates de peremption
    // differentes en une seule reception (ex: reliquat d'un ancien lot +
    // nouveau lot). Rien n'est invente cote serveur : une ligne peut tres
    // bien n'avoir recu aucun sous-lot (rien de livre pour ce medicament).
    interface SousLot { quantite: number; datePeremption: string }
    const lignesRecues: { ligneId: string; sousLots: SousLot[] }[] = body.lignes || []

    if (lignesRecues.length === 0) {
      return apiError('Aucune ligne de reception fournie', 400)
    }

    const lignesParId = new Map(commande.lignes.map((l) => [l.id, l]))

    for (const lr of lignesRecues) {
      const ligne = lignesParId.get(lr.ligneId)
      if (!ligne) return apiError(`Ligne ${lr.ligneId} introuvable sur cette commande`, 400)
      const sousLots = lr.sousLots || []
      for (const sl of sousLots) {
        if (sl.quantite === undefined || sl.quantite === null || sl.quantite < 0) {
          return apiError('Quantite recue manquante ou invalide sur une ligne', 400)
        }
        // La date de peremption n'est exigee que si quelque chose est
        // reellement recu sur ce sous-lot — un sous-lot a 0 (ou une ligne
        // sans aucun sous-lot) n'a pas de date a fournir.
        if (sl.quantite > 0 && (!sl.datePeremption || isNaN(new Date(sl.datePeremption).getTime()))) {
          return apiError('Date de peremption manquante ou invalide sur une ligne recue', 400)
        }
      }
    }

    const ecarts: { ligneId: string; medicamentId: string | null; commande: number; recue: number }[] = []

    await prisma.$transaction(async (tx) => {
      for (const lr of lignesRecues) {
        const ligne = lignesParId.get(lr.ligneId)!
        const sousLots = (lr.sousLots || []).filter((sl) => sl.quantite > 0)
        const totalRecu = sousLots.reduce((s, sl) => s + sl.quantite, 0)

        if (!ligne.medicamentId) {
          console.warn(`Ligne ${ligne.id} sans medicamentId — ignoree`)
          continue
        }

        if (totalRecu < ligne.quantite) {
          ecarts.push({
            ligneId: ligne.id,
            medicamentId: ligne.medicamentId,
            commande: ligne.quantite,
            recue: totalRecu,
          })
        }

        // Enregistrer la quantite totale reellement recue sur la ligne
        await tx.ligneCommande.update({
          where: { id: ligne.id },
          data: { quantiteRecue: totalRecu },
        })

        // Un Lot distinct par sous-lot recu (une date de peremption = un lot)
        for (const sl of sousLots) {
          await tx.lot.create({
            data: {
              medicamentId: ligne.medicamentId,
              pharmacieId,
              fournisseurId: commande.fournisseurId,
              commandeFournisseurId: commande.id,
              quantite: sl.quantite,
              prixAchat: ligne.prixUnitaire,
              datePeremption: new Date(sl.datePeremption),
            },
          })

          await tx.mouvementStock.create({
            data: {
              type: 'ENTREE',
              quantite: sl.quantite,
              medicamentId: ligne.medicamentId,
              userId,
              commandeId: commande.id,
            },
          })
        }
      }

      // Mettre à jour le statut de la commande et sa date de reception reelle
      await tx.commandeFournisseur.update({
        where: { id: params.id },
        data: { statut: 'RECUE', dateReception: new Date() },
      })
    })

    await createAuditLog({
      action: 'COMMANDE_RECEPTIONNEE',
      details: { commandeId: params.id, nbLignes: commande.lignes.length },
      userId,
      pharmacieId,
    })

    // Ecart de livraison : trace separement pour permettre un filtre dedie
    // et alimenter plus tard l'indicateur de fiabilite fournisseur
    if (ecarts.length > 0) {
      await createAuditLog({
        action: 'COMMANDE_ECART_LIVRAISON',
        details: { commandeId: params.id, ecarts },
        userId,
        pharmacieId,
      })
    }

    return apiSuccess({ message: 'Commande receptionnee avec succes', ecarts })
  }

  // Pour les autres changements de statut (ENVOYEE, ANNULEE)
  const updated = await prisma.commandeFournisseur.update({
    where: { id: params.id },
    data: { statut },
  })

  await createAuditLog({
    action: 'COMMANDE_STATUT_CHANGE',
    details: { commandeId: params.id, statut },
    userId,
    pharmacieId,
  })

  return apiSuccess(updated)
}