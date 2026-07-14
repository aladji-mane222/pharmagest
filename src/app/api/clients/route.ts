import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiError, apiSuccess } from '@/lib/utils'
import { createAuditLog } from '@/lib/audit'
import { genererNumeroClient } from '@/lib/numerotation'

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

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function normaliserTelephone(tel: string): string {
  let chiffres = tel.replace(/\D/g, '')
  if (chiffres.length > 9 && chiffres.startsWith('224')) {
    chiffres = chiffres.slice(3)
  }
  return chiffres
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return apiError('Non autorise', 401)

  const body = await request.json()
  const { nom, telephone, email, plafondCredit } = body

  if (!nom) return apiError('Nom du client requis', 400)
  if (email && email.trim() && !EMAIL_REGEX.test(email.trim())) {
    return apiError('Email invalide', 400)
  }

  // Meme logique que l'import en masse : telephone et email sont les seuls
  // signaux fiables pour detecter un doublon de CLIENT (personne physique)
  // — le nom seul n'est pas fiable en contexte guineen (homonymes tres
  // frequents : Camara, Sylla, Soumah...), donc on ne bloque jamais sur le
  // nom seul ici.
  if ((telephone && telephone.trim()) || (email && email.trim())) {
    // Postgres ne normalise pas les numeros/emails au format libre saisi par
    // l'utilisateur, donc on compare cote code plutot qu'en SQL — le volume
    // de clients par pharmacie reste faible, cout negligeable.
    const clients = await prisma.client.findMany({
      where: { pharmacieId: session.user.pharmacieId, actif: true },
      select: { id: true, nom: true, telephone: true, email: true },
    })

    if (telephone && telephone.trim()) {
      const telNorm = normaliserTelephone(telephone)
      const existant = clients.find((c) => c.telephone && normaliserTelephone(c.telephone) === telNorm)
      if (existant) {
        return apiError(`Un client avec ce numero de telephone existe deja (${existant.nom})`, 409)
      }
    }

    if (email && email.trim()) {
      const emailNorm = email.trim().toLowerCase()
      const existant = clients.find((c) => c.email && c.email.toLowerCase() === emailNorm)
      if (existant) {
        return apiError(`Un client avec cet email existe deja (${existant.nom})`, 409)
      }
    }
  }

  const client = await prisma.$transaction(async (tx) => {
    const numeroClient = await genererNumeroClient(tx, session.user.pharmacieId)
    return tx.client.create({
      data: {
        numeroClient,
        nom,
        telephone: telephone || null,
        email: email || null,
        plafondCredit: plafondCredit ? parseFloat(plafondCredit) : 50000,
        pharmacieId: session.user.pharmacieId,
      },
    })
  })

  await createAuditLog({
    action: 'CLIENT_CREE',
    details: { clientId: client.id, nom: client.nom },
    userId: session.user.id,
    pharmacieId: session.user.pharmacieId,
  })

  return apiSuccess(client, 201)
}