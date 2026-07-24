
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiError, apiSuccess } from '@/lib/utils'
import { createAuditLog } from '@/lib/audit'

function normaliserNom(nom: string): string {
  return nom
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
}

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return apiError('Non autorise', 401)

  const medicament = await prisma.medicament.findFirst({
    where: { id: params.id, pharmacieId: session.user.pharmacieId, actif: true },
    include: { lots: { where: { actif: true }, orderBy: { datePeremption: 'asc' } } },
  })

  if (!medicament) return apiError('Medicament non trouve', 404)

  const stockTotal = medicament.lots.reduce((sum, lot) => sum + lot.quantite, 0)
  return apiSuccess({ ...medicament, stockTotal })
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return apiError('Non autorise', 401)
  if (session.user.role === 'CAISSIER') return apiError('Acces refuse', 403)

  const medicament = await prisma.medicament.findFirst({
    where: { id: params.id, pharmacieId: session.user.pharmacieId },
  })
  if (!medicament) return apiError('Medicament non trouve', 404)

  const body = await request.json()
  const {
    nom,
    description,
    categorie,
    unite,
    prixVente,
    prixAchat,
    stockMinimum,
    codeBarre,
    dci,
    ordonnanceObligatoire,
    forcerCreation,
  } = body

  // Le code-barres est unique par pharmacie (@@unique([pharmacieId, codeBarre])
  // en base) — on verifie cote code avant l'update pour renvoyer un message
  // clair plutot que de laisser Prisma remonter une erreur P2002 brute.
  // On exclut ce medicament lui-meme (permet de re-sauvegarder sans y toucher).
  if (codeBarre !== undefined && codeBarre !== null && codeBarre.trim()) {
    const conflit = await prisma.medicament.findFirst({
      where: {
        pharmacieId: session.user.pharmacieId,
        codeBarre: codeBarre.trim(),
        id: { not: params.id },
      },
      select: { nom: true },
    })
    if (conflit) {
      return apiError(`Ce code-barres est deja utilise par "${conflit.nom}"`, 409)
    }
  }

  // Doublon par nom — meme oubli que sur la creation, corrige en meme
  // temps (trouve en testant reellement le 24/07/2026 : la creation
  // bloquait deja mais pas l'edition).
  if (nom !== undefined && normaliserNom(nom) !== normaliserNom(medicament.nom)) {
    const medicamentsExistants = await prisma.medicament.findMany({
      where: { pharmacieId: session.user.pharmacieId, actif: true, id: { not: params.id } },
      select: { nom: true },
    })
    const nomNorm = normaliserNom(nom)
    const doublonNom = medicamentsExistants.find((m) => normaliserNom(m.nom) === nomNorm)
    if (doublonNom) {
      return apiError(`Un medicament avec ce nom existe deja (${doublonNom.nom})`, 409)
    }
    if (!forcerCreation) {
      const proche = medicamentsExistants.find((m) => {
        const mNorm = normaliserNom(m.nom)
        return mNorm !== nomNorm && (mNorm.includes(nomNorm) || nomNorm.includes(mNorm))
      })
      if (proche) {
        return apiError(
          `Un medicament au nom proche existe deja : "${proche.nom}"`,
          409,
          { avertissement: true, nomSimilaire: proche.nom }
        )
      }
    }
  }

  const updated = await prisma.medicament.update({
    where: { id: params.id },
    data: {
      ...(nom && { nom }),
      ...(description !== undefined && { description }),
      ...(categorie !== undefined && { categorie }),
      ...(unite && { unite }),
      ...(prixVente && { prixVente: parseFloat(prixVente) }),
      ...(prixAchat !== undefined && { prixAchat: prixAchat ? parseFloat(prixAchat) : null }),
      ...(stockMinimum && { stockMinimum: parseInt(stockMinimum) }),
      ...(codeBarre !== undefined && { codeBarre: codeBarre && codeBarre.trim() ? codeBarre.trim() : null }),
      ...(dci !== undefined && { dci: dci && dci.trim() ? dci.trim() : null }),
      ...(ordonnanceObligatoire !== undefined && { ordonnanceObligatoire: !!ordonnanceObligatoire }),
    },
  })

  await createAuditLog({
    action: 'MEDICAMENT_MODIFIE',
    details: { medicamentId: updated.id, nom: updated.nom },
    userId: session.user.id,
    pharmacieId: session.user.pharmacieId,
  })

  return apiSuccess(updated)
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return apiError('Non autorise', 401)
  if (session.user.role === 'CAISSIER') return apiError('Acces refuse', 403)

  const medicament = await prisma.medicament.findFirst({
    where: { id: params.id, pharmacieId: session.user.pharmacieId },
  })
  if (!medicament) return apiError('Medicament non trouve', 404)

  await prisma.medicament.update({
    where: { id: params.id },
    data: { actif: false },
  })

  await createAuditLog({
    action: 'MEDICAMENT_ARCHIVE',
    details: { medicamentId: params.id, nom: medicament.nom },
    userId: session.user.id,
    pharmacieId: session.user.pharmacieId,
  })

  return apiSuccess({ message: 'Medicament archive avec succes' })
}