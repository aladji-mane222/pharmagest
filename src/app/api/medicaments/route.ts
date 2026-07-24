
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

export async function GET(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return apiError('Non autorise', 401)

  const pharmacieId = session.user.pharmacieId
  const { searchParams } = new URL(request.url)
  const search = searchParams.get('search') || ''
  const codeBarre = searchParams.get('codeBarre') || ''
  const categorie = searchParams.get('categorie') || ''
  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '20')
  const offset = (page - 1) * limit

  // codeBarre : recherche exacte prioritaire (cas scan douchette POS, Phase
  // 3.4bis — une douchette tape le code puis Entree, on veut une correspondance
  // exacte immediate, pas un "contains" qui pourrait matcher plusieurs lignes).
  // search : recherche generale, matche desormais nom OU codeBarre partiel,
  // pour couvrir aussi le cas ou quelqu'un tape/colle un code-barres dans la
  // barre de recherche classique plutot que de scanner.
  const where = {
    pharmacieId,
    actif: true,
    ...(codeBarre && { codeBarre }),
    ...(search &&
      !codeBarre && {
        OR: [
          { nom: { contains: search, mode: 'insensitive' as const } },
          { codeBarre: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
    ...(categorie && { categorie }),
  }

  const [medicamentsRaw, total, categoriesRaw] = await Promise.all([
    prisma.medicament.findMany({
      where,
      include: { lots: { where: { actif: true }, select: { quantite: true } } },
      orderBy: { nom: 'asc' },
      skip: offset,
      take: limit,
    }),
    prisma.medicament.count({ where }),
    // Liste complete des categories du catalogue, independante de la page
    // et de la recherche en cours — sinon le menu deroulant de filtre ne
    // proposerait que les categories visibles sur la page courante
    // (constate en usage reel le 12/07/2026 avec la pagination manquante).
    prisma.medicament.findMany({
      where: { pharmacieId, actif: true, categorie: { not: null } },
      select: { categorie: true },
      distinct: ['categorie'],
      orderBy: { categorie: 'asc' },
    }),
  ])

  const medicaments = medicamentsRaw.map(({ lots, ...m }) => ({
    ...m,
    stockTotal: lots.reduce((sum, l) => sum + l.quantite, 0),
  }))
  const categories = categoriesRaw.map((c) => c.categorie).filter(Boolean)

  return apiSuccess({ medicaments, total, page, limit, categories })
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return apiError('Non autorise', 401)
  if (session.user.role === 'CAISSIER') return apiError('Acces refuse', 403)

  const pharmacieId = session.user.pharmacieId
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

  if (!nom || !prixVente) return apiError('Nom et prix de vente requis', 400)

  if (codeBarre && codeBarre.trim()) {
    const conflit = await prisma.medicament.findFirst({
      where: { pharmacieId, codeBarre: codeBarre.trim() },
      select: { nom: true },
    })
    if (conflit) {
      return apiError(`Ce code-barres est deja utilise par "${conflit.nom}"`, 409)
    }
  }

  // Doublon par nom — absent jusqu'ici (seul le code-barres etait
  // verifie, optionnel). Trouve en testant reellement le 23/07/2026.
  // Meme normalisation (accents/casse/espaces) que fournisseurs/clients.
  const nomNorm = normaliserNom(nom)
  const medicamentsExistants = await prisma.medicament.findMany({
    where: { pharmacieId, actif: true },
    select: { nom: true },
  })
  const doublonNom = medicamentsExistants.find((m) => normaliserNom(m.nom) === nomNorm)
  if (doublonNom) {
    return apiError(`Un medicament avec ce nom existe deja (${doublonNom.nom})`, 409)
  }

  // Avertissement NON-BLOQUANT (nom proche, pas exact) — demande par
  // Nabe le 24/07/2026, meme mecanisme que fournisseurs : un nom
  // contient l'autre apres normalisation. On laisse passer si
  // forcerCreation: true est renvoye par le formulaire.
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

  const medicament = await prisma.medicament.create({
    data: {
      nom,
      description,
      categorie,
      unite: unite || 'comprime',
      prixVente: parseFloat(prixVente),
      prixAchat: prixAchat ? parseFloat(prixAchat) : null,
      stockMinimum: stockMinimum ? parseInt(stockMinimum) : 10,
      codeBarre: codeBarre && codeBarre.trim() ? codeBarre.trim() : null,
      dci: dci && dci.trim() ? dci.trim() : null,
      ordonnanceObligatoire: !!ordonnanceObligatoire,
      pharmacieId,
    },
  })

  await createAuditLog({
    action: 'MEDICAMENT_CREE',
    details: { medicamentId: medicament.id, nom: medicament.nom },
    userId: session.user.id,
    pharmacieId,
  })

  return apiSuccess(medicament, 201)
}