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
    // Le front doit desormais envoyer, pour chaque ligne de la commande,
    // la quantite reellement livree et la date de peremption reelle du
    // lot recu. Rien n'est invente cote serveur.
    const lignesRecues: { ligneId: string; quantiteRecue: number; datePeremption: string }[] =
      body.lignes || []

    if (lignesRecues.length === 0) {
      return apiError('Aucune ligne de reception fournie', 400)
    }

    const lignesParId = new Map(commande.lignes.map((l) => [l.id, l]))

    for (const lr of lignesRecues) {
      const ligne = lignesParId.get(lr.ligneId)
      if (!ligne) return apiError(`Ligne ${lr.ligneId} introuvable sur cette commande`, 400)
      if (lr.quantiteRecue === undefined || lr.quantiteRecue === null || lr.quantiteRecue < 0) {
        return apiError('Quantite recue manquante ou invalide sur une ligne', 400)
      }
      if (!lr.datePeremption || isNaN(new Date(lr.datePeremption).getTime())) {
        return apiError('Date de peremption manquante ou invalide sur une ligne', 400)
      }
    }

    const ecarts: { ligneId: string; medicamentId: string | null; commande: number; recue: number }[] = []

    await prisma.$transaction(async (tx) => {
      for (const lr of lignesRecues) {
        const ligne = lignesParId.get(lr.ligneId)!
        if (!ligne.medicamentId) {
          console.warn(`Ligne ${ligne.id} sans medicamentId — ignoree`)
          continue
        }

        if (lr.quantiteRecue < ligne.quantite) {
          ecarts.push({
            ligneId: ligne.id,
            medicamentId: ligne.medicamentId,
            commande: ligne.quantite,
            recue: lr.quantiteRecue,
          })
        }

        // Enregistrer la quantite reellement recue sur la ligne
        await tx.ligneCommande.update({
          where: { id: ligne.id },
          data: { quantiteRecue: lr.quantiteRecue },
        })

        // Ne creer un lot que si quelque chose a effectivement ete recu
        if (lr.quantiteRecue > 0) {
          await tx.lot.create({
            data: {
              medicamentId: ligne.medicamentId,
              pharmacieId,
              fournisseurId: commande.fournisseurId,
              commandeFournisseurId: commande.id,
              quantite: lr.quantiteRecue,
              prixAchat: ligne.prixUnitaire,
              datePeremption: new Date(lr.datePeremption),
            },
          })

          await tx.mouvementStock.create({
            data: {
              type: 'ENTREE',
              quantite: lr.quantiteRecue,
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