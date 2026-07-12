import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiError, apiSuccess } from '@/lib/utils'
import { createAuditLog } from '@/lib/audit'

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return apiError('Non autorise', 401)

  const fournisseur = await prisma.fournisseur.findFirst({
    where: { id: params.id, pharmacieId: session.user.pharmacieId },
    include: { commandes: { orderBy: { createdAt: 'desc' }, take: 5 } },
  })

  if (!fournisseur) return apiError('Fournisseur non trouve', 404)
  return apiSuccess(fournisseur)
}

function normaliserNom(nom: string): string {
  return nom
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
}

function normaliserTelephone(tel: string): string {
  let chiffres = tel.replace(/\D/g, '')
  if (chiffres.length > 9 && chiffres.startsWith('224')) {
    chiffres = chiffres.slice(3)
  }
  return chiffres
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return apiError('Non autorise', 401)
  if (session.user.role === 'CAISSIER') return apiError('Acces refuse', 403)

  const fournisseur = await prisma.fournisseur.findFirst({
    where: { id: params.id, pharmacieId: session.user.pharmacieId },
  })
  if (!fournisseur) return apiError('Fournisseur non trouve', 404)

  const body = await request.json()
  const { nom, contact, telephone, email, delaiLivraison } = body

  if (email !== undefined && email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return apiError('Email invalide', 400)
  }

  // Meme logique que la creation/l'import : on exclut toujours ce
  // fournisseur (params.id) des resultats de comparaison, et on ne
  // compare que les champs qui changent reellement.
  const nomChange = nom && nom !== fournisseur.nom
  const telChange = telephone !== undefined && telephone && telephone !== fournisseur.telephone
  const emailChange = email !== undefined && email && email !== fournisseur.email

  if (nomChange || telChange || emailChange) {
    const autresFournisseurs = await prisma.fournisseur.findMany({
      where: { pharmacieId: session.user.pharmacieId, actif: true, id: { not: params.id } },
      select: { id: true, nom: true, telephone: true, email: true },
    })

    if (telChange) {
      const telNorm = normaliserTelephone(telephone)
      const existant = autresFournisseurs.find((f) => f.telephone && normaliserTelephone(f.telephone) === telNorm)
      if (existant) {
        return apiError(`Un autre fournisseur avec ce numero de telephone existe deja (${existant.nom})`, 409)
      }
    }

    if (emailChange) {
      const emailNorm = email.trim().toLowerCase()
      const existant = autresFournisseurs.find((f) => f.email && f.email.toLowerCase() === emailNorm)
      if (existant) {
        return apiError(`Un autre fournisseur avec cet email existe deja (${existant.nom})`, 409)
      }
    }

    if (nomChange) {
      const nomNorm = normaliserNom(nom)
      const existant = autresFournisseurs.find((f) => normaliserNom(f.nom) === nomNorm)
      if (existant) {
        return apiError(`Un autre fournisseur avec ce nom existe deja (${existant.nom})`, 409)
      }
    }
  }

  const updated = await prisma.fournisseur.update({
    where: { id: params.id },
    data: {
      ...(nom && { nom }),
      ...(contact !== undefined && { contact }),
      ...(telephone !== undefined && { telephone }),
      ...(email !== undefined && { email }),
      ...(delaiLivraison !== undefined && { delaiLivraison: delaiLivraison ? parseInt(delaiLivraison) : null }),
    },
  })

  await createAuditLog({
    action: 'FOURNISSEUR_MODIFIE',
    details: { fournisseurId: params.id, nom: updated.nom },
    userId: session.user.id,
    pharmacieId: session.user.pharmacieId,
  })

  return apiSuccess(updated)
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return apiError('Non autorise', 401)
  if (session.user.role === 'CAISSIER') return apiError('Acces refuse', 403)

  const fournisseur = await prisma.fournisseur.findFirst({
    where: { id: params.id, pharmacieId: session.user.pharmacieId },
  })
  if (!fournisseur) return apiError('Fournisseur non trouve', 404)

  await prisma.fournisseur.update({
    where: { id: params.id },
    data: { actif: false },
  })

  await createAuditLog({
    action: 'FOURNISSEUR_ARCHIVE',
    details: { fournisseurId: params.id },
    userId: session.user.id,
    pharmacieId: session.user.pharmacieId,
  })

  return apiSuccess({ message: 'Fournisseur archive' })
}