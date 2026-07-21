
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiError, apiSuccess } from '@/lib/utils'

// Equivalents generiques (Phase 3.4ter) : autres medicaments actifs de la
// meme pharmacie partageant le meme DCI (Denomination Commune
// Internationale), utile en cas de rupture pour proposer une alternative
// therapeutiquement equivalente. Route dediee plutot qu'un parametre de
// plus sur /api/medicaments : la semantique est differente (exclut le
// medicament d'origine, ne renvoie que des equivalents ayant du stock).
//
// NOTE (21/07/2026) : au moment de construire cette route, seuls 2
// medicaments sur tout le catalogue de la pharmacie pilote avaient un DCI
// renseigne — la fonctionnalite est donc fonctionnellement prete mais
// n'aura d'effet visible qu'au fur et a mesure que le champ DCI (deja
// editable sur la fiche medicament) sera rempli.
export async function GET(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return apiError('Non autorise', 401)

  const pharmacieId = session.user.pharmacieId

  const medicament = await prisma.medicament.findFirst({
    where: { id: params.id, pharmacieId },
    select: { id: true, dci: true },
  })
  if (!medicament) return apiError('Medicament non trouve', 404)
  if (!medicament.dci) return apiSuccess({ equivalents: [] })

  const equivalentsRaw = await prisma.medicament.findMany({
    where: {
      pharmacieId,
      actif: true,
      dci: medicament.dci,
      id: { not: medicament.id },
    },
    include: { lots: { where: { actif: true }, select: { quantite: true } } },
    orderBy: { nom: 'asc' },
  })

  const equivalents = equivalentsRaw
    .map(({ lots, ...m }) => ({ ...m, stockTotal: lots.reduce((s, l) => s + l.quantite, 0) }))
    // Un equivalent sans aucun stock n'aide pas plus que la rupture
    // d'origine — inutile de le proposer
    .filter((m) => m.stockTotal > 0)

  return apiSuccess({ equivalents })
}