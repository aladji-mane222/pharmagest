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

    await prisma.$transaction(async (tx) => {
      for (const ligne of commande.lignes) {
        // ─── Bug #1 corrigé : ligne.medicamentId au lieu de ligne.id ─────
        if (!ligne.medicamentId) {
          console.warn(`Ligne ${ligne.id} sans medicamentId — ignoree`)
          continue
        }

        // Créer le lot avec pharmacieId obligatoire, relie a la commande et
        // au fournisseur d'origine pour la tracabilite (rappel de lot,
        // Phase 2BIS)
        await tx.lot.create({
          data: {
            medicamentId: ligne.medicamentId,
            pharmacieId,
            fournisseurId: commande.fournisseurId,
            commandeFournisseurId: commande.id,
            quantite: ligne.quantite,
            prixAchat: ligne.prixUnitaire,
            datePeremption: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
          },
        })

        // Créer le MouvementStock ENTREE pour traçabilité, relie a la commande
        await tx.mouvementStock.create({
          data: {
            type: 'ENTREE',
            quantite: ligne.quantite,
            medicamentId: ligne.medicamentId,
            userId,
            commandeId: commande.id,
          },
        })
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

    return apiSuccess({ message: 'Commande receptionnee avec succes' })
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