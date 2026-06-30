import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiError, apiSuccess } from '@/lib/utils'
import { createAuditLog } from '@/lib/audit'

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return apiError('Non autorise', 401)

  const client = await prisma.client.findFirst({
    where: { id: params.id, pharmacieId: session.user.pharmacieId },
    include: {
      ventes: {
        orderBy: { createdAt: 'desc' },
        take: 20,
        include: {
          lignes: {
            include: { medicament: true },
          },
        },
      },
    },
  })

  if (!client) return apiError('Client non trouve', 404)

  return apiSuccess(client)
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return apiError('Non autorise', 401)
  if (session.user.role === 'CAISSIER') return apiError('Acces refuse', 403)

  const pharmacieId = session.user.pharmacieId

  const client = await prisma.client.findFirst({
    where: { id: params.id, pharmacieId },
  })
  if (!client) return apiError('Client non trouve', 404)

  const body = await request.json()
  const { nom, telephone, email, plafondCredit } = body

  const dataToUpdate: {
    nom?: string
    telephone?: string | null
    email?: string | null
    plafondCredit?: number
  } = {}

  if (nom !== undefined) dataToUpdate.nom = nom
  if (telephone !== undefined) dataToUpdate.telephone = telephone || null
  if (email !== undefined) dataToUpdate.email = email || null
  if (plafondCredit !== undefined) {
    const plafond = parseFloat(plafondCredit)
    if (isNaN(plafond) || plafond < 0) return apiError('Plafond invalide', 400)
    dataToUpdate.plafondCredit = plafond
  }

  const updated = await prisma.client.update({
    where: { id: params.id },
    data: dataToUpdate,
  })

  await createAuditLog({
    action: 'CLIENT_MODIFIE',
    details: { clientId: params.id, changements: dataToUpdate },
    userId: session.user.id,
    pharmacieId,
  })

  return apiSuccess(updated)
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return apiError('Non autorise', 401)
  if (session.user.role === 'CAISSIER') return apiError('Acces refuse', 403)

  const pharmacieId = session.user.pharmacieId

  const client = await prisma.client.findFirst({
    where: { id: params.id, pharmacieId },
  })
  if (!client) return apiError('Client non trouve', 404)
  if (!client.actif) return apiError('Client deja archive', 400)
  if (client.soldeCredit > 0) return apiError('Client a un solde credit en cours', 400)

  const archived = await prisma.client.update({
    where: { id: params.id },
    data: { actif: false },
  })

  await createAuditLog({
    action: 'CLIENT_ARCHIVE',
    details: { clientId: params.id, nom: client.nom },
    userId: session.user.id,
    pharmacieId,
  })

  return apiSuccess(archived)
}
