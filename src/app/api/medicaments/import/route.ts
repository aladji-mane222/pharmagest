import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiError, apiSuccess } from '@/lib/utils'
import { createAuditLog } from '@/lib/audit'
import type { LignePreview } from '@/components/ui/ImportModal'

const MAX_LIGNES = 5000

/**
 * Normalise un nom de medicament pour la comparaison de doublons :
 * minuscules, accents retires (NFD + suppression des marques diacritiques),
 * espaces multiples reduits a un seul, espaces de debut/fin retires.
 *
 * Sans ca, "Paracétamol" et "Paracetamol", ou "Doliprane  500mg" (deux
 * espaces) et "Doliprane 500mg", ne sont pas detectes comme le meme
 * medicament — constate en usage reel le 10/07/2026 lors du premier test
 * d'import par Nabe.
 */
function normaliserNom(nom: string): string {
  return nom
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // retire les marques diacritiques (accents)
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
}

interface LigneEntree {
  nom: string
  categorie: string
  unite: string
  prixVente: string
  prixAchat: string
  stockMinimum: string
  [key: string]: string
}

/**
 * Valide une ligne (sans toucher la base) : champs obligatoires + coherence
 * des nombres. Ne verifie PAS les doublons — fait separement, en lot, car
 * ca necessite de comparer a tout le catalogue existant de la pharmacie.
 */
function validerLigne(valeurs: LigneEntree): string | null {
  if (!valeurs.nom || valeurs.nom.trim() === '') {
    return 'Nom manquant'
  }
  if (!valeurs.prixVente || valeurs.prixVente.trim() === '') {
    return 'Prix de vente manquant'
  }
  const prixVente = parseFloat(valeurs.prixVente.replace(',', '.'))
  if (Number.isNaN(prixVente) || prixVente <= 0) {
    return 'Prix de vente invalide'
  }
  if (valeurs.prixAchat && valeurs.prixAchat.trim() !== '') {
    const prixAchat = parseFloat(valeurs.prixAchat.replace(',', '.'))
    if (Number.isNaN(prixAchat) || prixAchat < 0) {
      return 'Prix d\'achat invalide'
    }
  }
  if (valeurs.stockMinimum && valeurs.stockMinimum.trim() !== '') {
    const stockMin = parseInt(valeurs.stockMinimum, 10)
    if (Number.isNaN(stockMin) || stockMin < 0) {
      return 'Stock minimum invalide'
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

  // ─── Catalogue existant de la pharmacie (pour la detection de doublons) ──
  const medicamentsExistants = await prisma.medicament.findMany({
    where: { pharmacieId, actif: true },
    select: { id: true, nom: true },
  })
  const nomsExistants = new Map(
    medicamentsExistants.map((m) => [normaliserNom(m.nom), m.id])
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
        return { index, valeurs, statut: 'doublon', message: 'Deja present dans le catalogue' }
      }

      // Doublon a l'interieur du fichier lui-meme (deux lignes, meme nom)
      if (nomsVusDansLeFichier.has(nomNormalise)) {
        return { index, valeurs, statut: 'doublon', message: 'Doublon dans le fichier importe' }
      }
      nomsVusDansLeFichier.add(nomNormalise)

      return { index, valeurs, statut: 'ok' }
    })

    return apiSuccess({ lignes: resultats })
  }

  // ─── mode === 'confirm' ────────────────────────────────────────────────
  const lignes: { valeurs: LigneEntree; action: 'creer' | 'ignorer' | 'mettreAJour' }[] = body.lignes || []
  if (lignes.length === 0) return apiError('Aucune ligne a importer', 400)
  if (lignes.length > MAX_LIGNES) {
    return apiError(`Trop de lignes (max ${MAX_LIGNES})`, 400)
  }

  let crees = 0
  let misAJour = 0
  let ignores = 0
  let erreurs = 0

  await prisma.$transaction(
    async (tx) => {
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
        categorie: valeurs.categorie?.trim() || null,
        unite: valeurs.unite?.trim() || 'comprime',
        prixVente: parseFloat(valeurs.prixVente.replace(',', '.')),
        prixAchat: valeurs.prixAchat?.trim()
          ? parseFloat(valeurs.prixAchat.replace(',', '.'))
          : null,
        stockMinimum: valeurs.stockMinimum?.trim()
          ? parseInt(valeurs.stockMinimum, 10)
          : 10,
      }

      if (action === 'mettreAJour' && idExistant) {
        await tx.medicament.update({ where: { id: idExistant }, data: donnees })
        misAJour++
      } else {
        await tx.medicament.create({ data: { ...donnees, pharmacieId } })
        crees++
      }
    }
    },
    { timeout: 60000, maxWait: 10000 }
  )

  await createAuditLog({
    action: 'IMPORT_MEDICAMENTS',
    details: { crees, misAJour, ignores, erreurs, total: lignes.length },
    userId: session.user.id,
    pharmacieId,
  })

  return apiSuccess({ crees, misAJour, ignores, erreurs })
}