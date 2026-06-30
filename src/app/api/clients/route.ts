import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiError, apiSuccess } from '@/lib/utils'
import { createAuditLog } from '@/lib/audit'

export async function GET(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return apiError('Non autorise', 401)

  const { searchParams } = new URL(request.url)
  const search = searchParams.get('search') || ''
  const avecCredit = searchParams.get('avecCredit') === 'true'

  const clients = await prisma.client.findMany({
    where: {
      pharmacieId: session.user.pharmacieId,
      actif: true,
      ...(search && { nom: { contains: search, mode: 'insensitive' as const } }),
      ...(avecCredit && { soldeCredit: { gt: 0 } }),
    },
    orderBy: avecCredit ? { soldeCredit: 'desc' } : { nom: 'asc' },
  })

  return new Response(JSON.stringify({ success: true, data: clients }), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 's-maxage=120, stale-while-revalidate=60',
    },
  })
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return apiError('Non autorise', 401)

  const body = await request.json()
  const { nom, telephone, email, plafondCredit } = body

  if (!nom) return apiError('Nom du client requis', 400)

  const client = await prisma.client.create({
    data: {
      nom,
      telephone: telephone || null,
      email: email || null,
      plafondCredit: plafondCredit ? parseFloat(plafondCredit) : 50000,
      pharmacieId: session.user.pharmacieId,
    },
  })

  await createAuditLog({
    action: 'CLIENT_CREE',
    details: { clientId: client.id, nom: client.nom },
    userId: session.user.id,
    pharmacieId: session.user.pharmacieId,
  })

  return apiSuccess(client, 201)
}
