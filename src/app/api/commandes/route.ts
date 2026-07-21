// CIBLE: src/app/api/commandes/route.ts

import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiError, apiSuccess } from '@/lib/utils'
import { createAuditLog } from '@/lib/audit'
import { genererNumeroCommande } from '@/lib/numerotation'

export async function GET(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return apiError('Non autorise', 401)

  const { searchParams } = new URL(request.url)
  const fournisseurId = searchParams.get('fournisseurId') || ''
  const statut         = searchParams.get('statut') || ''
  const dateDebut       = searchParams.get('dateDebut') || ''
  const dateFin         = searchParams.get('dateFin') || ''
  // Un filtre applique = usage "historique/export" -> pas de plafond a 20.
  // Vue par defaut (page commandes, aucun filtre) = les 20 plus recentes,
  // comportement inchange pour ne pas ralentir l'ecran de travail courant.
  const filtreActif = !!(fournisseurId || statut || dateDebut || dateFin)

  const where: Record<string, unknown> = { pharmacieId: session.user.pharmacieId }
  if (fournisseurId) where.fournisseurId = fournisseurId
  if (statut)         where.statut       = statut
  if (dateDebut || dateFin) {
    const fin = dateFin ? new Date(dateFin) : undefined
    if (fin) fin.setUTCHours(23, 59, 59, 999)
    where.createdAt = {
      ...(dateDebut && { gte: new Date(dateDebut) }),
      ...(fin       && { lte: fin }),
    }
  }

  const commandes = await prisma.commandeFournisseur.findMany({
    where,
    include: {
      fournisseur: { select: { nom: true } },
      lignes: {
        include: { medicament: { select: { nom: true } } },
      },
    },
    orderBy: { createdAt: 'desc' },
    ...(filtreActif ? {} : { take: 20 }),
  })

  return apiSuccess(commandes)
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return apiError('Non autorise', 401)
  if (session.user.role === 'CAISSIER') return apiError('Acces refuse', 403)

  const body = await request.json()
  const { fournisseurId, lignes, dateLivraisonPrevue } = body

  if (!fournisseurId || !lignes || lignes.length === 0) {
    return apiError('Fournisseur et lignes requis', 400)
  }

  // dateLivraisonPrevue est optionnelle : le formulaire propose une
  // suggestion (+7j) mais l'admin peut l'effacer. Si absente, on ne
  // fabrique jamais de date a sa place (voir bug corrige en Phase 3 —
  // la reception inventait deja une date, on ne reproduit pas le meme
  // probleme ici). Une commande sans date prevue est simplement exclue
  // du calcul de retard.
  let dateLivraisonPrevueParsed: Date | null = null
  if (dateLivraisonPrevue) {
    const d = new Date(dateLivraisonPrevue)
    if (isNaN(d.getTime())) return apiError('Date de livraison prevue invalide', 400)
    dateLivraisonPrevueParsed = d
  }

  const pharmacieId = session.user.pharmacieId

  const fournisseur = await prisma.fournisseur.findFirst({
    where: { id: fournisseurId, pharmacieId },
  })
  if (!fournisseur) return apiError('Fournisseur non trouve', 404)

  // Vérifier que chaque ligne a un medicamentId valide appartenant à la pharmacie
  const medicamentIds = lignes.map((l: any) => l.medicamentId).filter(Boolean)
  if (medicamentIds.length !== lignes.length) {
    return apiError('Chaque ligne doit avoir un medicamentId', 400)
  }

  const medicaments = await prisma.medicament.findMany({
    where: { id: { in: medicamentIds }, pharmacieId, actif: true },
  })
  if (medicaments.length !== medicamentIds.length) {
    return apiError('Un ou plusieurs medicaments sont invalides ou n\'appartiennent pas a cette pharmacie', 404)
  }

  const montantTotal = lignes.reduce(
    (sum: number, l: { quantite: number; prixUnitaire: number }) =>
      sum + l.quantite * l.prixUnitaire,
    0
  )

  const commande = await prisma.$transaction(async (tx) => {
    const numeroCommande = await genererNumeroCommande(tx, pharmacieId)
    return tx.commandeFournisseur.create({
      data: {
        numeroCommande,
        pharmacieId,
        fournisseurId,
        montantTotal,
        dateLivraisonPrevue: dateLivraisonPrevueParsed,
        lignes: {
          create: lignes.map((l: { medicamentId: string; quantite: number; prixUnitaire: number }) => ({
            medicamentId: l.medicamentId, // ← corrigé : était absent
            quantite: l.quantite,
            prixUnitaire: l.prixUnitaire,
          })),
        },
      },
      include: {
        lignes: { include: { medicament: { select: { nom: true } } } },
        fournisseur: true,
      },
    })
  })

  await createAuditLog({
    action: 'COMMANDE_CREEE',
    details: {
      numeroCommande: commande.numeroCommande,
      fournisseurNom: fournisseur.nom,
      montantTotal,
      nbLignes: lignes.length,
    },
    userId: session.user.id,
    pharmacieId,
  })

  return apiSuccess(commande, 201)
}