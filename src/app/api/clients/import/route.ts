import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiError, apiSuccess } from '@/lib/utils'
import { createAuditLog } from '@/lib/audit'
import type { LignePreview } from '@/components/ui/ImportModal'

const MAX_LIGNES = 5000

function normaliserNom(nom: string): string {
  return nom
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
}

interface LigneEntree {
  nom: string
  telephone: string
  email: string
  plafondCredit: string
  [key: string]: string
}

function validerLigne(valeurs: LigneEntree): string | null {
  if (!valeurs.nom || valeurs.nom.trim() === '') {
    return 'Nom manquant'
  }
  if (valeurs.plafondCredit && valeurs.plafondCredit.trim() !== '') {
    const plafond = parseFloat(valeurs.plafondCredit.replace(',', '.'))
    if (Number.isNaN(plafond) || plafond < 0) {
      return 'Plafond de credit invalide'
    }
  }
  return null
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return apiError('Non autorise', 401)
  if (session.user.role === 'CAISSIER') return apiError('Acces refuse', 403)

  const pharmacieId = session.user.pharmacieId
  const body = await request.json()
  const mode = body.mode as 'preview' | 'confirm'

  if (mode !== 'preview' && mode !== 'confirm') {
    return apiError('Mode invalide', 400)
  }

  const clientsExistants = await prisma.client.findMany({
    where: { pharmacieId, actif: true },
    select: { id: true, nom: true },
  })
  const nomsExistants = new Map(
    clientsExistants.map((c) => [normaliserNom(c.nom), c.id])
  )

  if (mode === 'preview') {
    const lignes: LigneEntree[] = body.lignes || []
    if (lignes.length === 0) return apiError('Aucune ligne a valider', 400)
    if (lignes.length > MAX_LIGNES) {
      return apiError(`Trop de lignes (max ${MAX_LIGNES})`, 400)
    }

    const nomsVusDansLeFichier = new Set<string>()
    const resultats: LignePreview[] = lignes.map((valeurs, index) => {
      const erreur = validerLigne(valeurs)
      if (erreur) {
        return { index, valeurs, statut: 'erreur', message: erreur }
      }

      const nomNormalise = normaliserNom(valeurs.nom)

      if (nomsExistants.has(nomNormalise)) {
        return { index, valeurs, statut: 'doublon', message: 'Deja present dans le fichier clients' }
      }
      if (nomsVusDansLeFichier.has(nomNormalise)) {
        return { index, valeurs, statut: 'doublon', message: 'Doublon dans le fichier importe' }
      }
      nomsVusDansLeFichier.add(nomNormalise)

      return { index, valeurs, statut: 'ok' }
    })

    return apiSuccess({ lignes: resultats })
  }

  const lignes: { valeurs: LigneEntree; action: 'creer' | 'ignorer' | 'mettreAJour' }[] = body.lignes || []
  if (lignes.length === 0) return apiError('Aucune ligne a importer', 400)
  if (lignes.length > MAX_LIGNES) {
    return apiError(`Trop de lignes (max ${MAX_LIGNES})`, 400)
  }

  let crees = 0
  let misAJour = 0
  let ignores = 0
  let erreurs = 0

  await prisma.$transaction(async (tx) => {
    for (const { valeurs, action } of lignes) {
      const erreurValidation = validerLigne(valeurs)
      if (erreurValidation) {
        erreurs++
        continue
      }

      if (action === 'ignorer') {
        ignores++
        continue
      }

      const nomNormalise = normaliserNom(valeurs.nom)
      const idExistant = nomsExistants.get(nomNormalise)

      const donnees = {
        nom: valeurs.nom.trim(),
        telephone: valeurs.telephone?.trim() || null,
        email: valeurs.email?.trim() || null,
        plafondCredit: valeurs.plafondCredit?.trim()
          ? parseFloat(valeurs.plafondCredit.replace(',', '.'))
          : 50000,
      }

      if (action === 'mettreAJour' && idExistant) {
        await tx.client.update({ where: { id: idExistant }, data: donnees })
        misAJour++
      } else {
        await tx.client.create({ data: { ...donnees, pharmacieId } })
        crees++
      }
    }
  })

  await createAuditLog({
    action: 'IMPORT_CLIENTS',
    details: { crees, misAJour, ignores, erreurs, total: lignes.length },
    userId: session.user.id,
    pharmacieId,
  })

  return apiSuccess({ crees, misAJour, ignores, erreurs })
}