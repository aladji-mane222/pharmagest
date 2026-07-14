import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiError, apiSuccess } from '@/lib/utils'
import { createAuditLog } from '@/lib/audit'
import { genererNumeroFournisseur } from '@/lib/numerotation'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return apiError('Non autorise', 401)

  const fournisseurs = await prisma.fournisseur.findMany({
    where: { pharmacieId: session.user.pharmacieId, actif: true },
    orderBy: { nom: 'asc' },
  })

  return new Response(JSON.stringify({ success: true, data: fournisseurs }), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 's-maxage=120, stale-while-revalidate=60',
    },
  })
}

function normaliserNom(nom: string): string {
  return nom
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
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
  if (session.user.role === 'CAISSIER') return apiError('Acces refuse', 403)

  const body = await request.json()
  const { nom, contact, telephone, email, delaiLivraison } = body

  if (!nom) return apiError('Nom du fournisseur requis', 400)
  if (email && email.trim() && !EMAIL_REGEX.test(email.trim())) {
    return apiError('Email invalide', 400)
  }

  // Meme logique que l'import en masse : pour une entreprise (contrairement
  // a une personne physique), le nom est un signal raisonnablement fiable
  // en plus du telephone et de l'email — les trois sont donc verifies ici.
  const fournisseursExistants = await prisma.fournisseur.findMany({
    where: { pharmacieId: session.user.pharmacieId, actif: true },
    select: { id: true, nom: true, telephone: true, email: true },
  })

  if (telephone && telephone.trim()) {
    const telNorm = normaliserTelephone(telephone)
    if (telNorm) {
      const existant = fournisseursExistants.find(
        (f) => f.telephone && normaliserTelephone(f.telephone) === telNorm
      )
      if (existant) {
        return apiError(`Un fournisseur avec ce numero de telephone existe deja (${existant.nom})`, 409)
      }
    }
  }

  if (email && email.trim()) {
    const emailNorm = email.trim().toLowerCase()
    const existant = fournisseursExistants.find((f) => f.email && f.email.toLowerCase() === emailNorm)
    if (existant) {
      return apiError(`Un fournisseur avec cet email existe deja (${existant.nom})`, 409)
    }
  }

  const nomNorm = normaliserNom(nom)
  const doublonNom = fournisseursExistants.find((f) => normaliserNom(f.nom) === nomNorm)
  if (doublonNom) {
    return apiError(`Un fournisseur avec ce nom existe deja (${doublonNom.nom})`, 409)
  }

  const fournisseur = await prisma.$transaction(async (tx) => {
    const numeroFournisseur = await genererNumeroFournisseur(tx, session.user.pharmacieId)
    return tx.fournisseur.create({
      data: {
        numeroFournisseur,
        nom,
        contact: contact || null,
        telephone: telephone || null,
        email: email || null,
        delaiLivraison: delaiLivraison ? parseInt(delaiLivraison) : null,
        pharmacieId: session.user.pharmacieId,
      },
    })
  })

  await createAuditLog({
    action: 'FOURNISSEUR_CREE',
    details: { fournisseurId: fournisseur.id, nom: fournisseur.nom },
    userId: session.user.id,
    pharmacieId: session.user.pharmacieId,
  })

  return apiSuccess(fournisseur, 201)
}