import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiError, apiSuccess } from '@/lib/utils'
import { createAuditLog } from '@/lib/audit'
import type { LignePreview } from '@/components/ui/ImportModal'

const MAX_LIGNES = 5000

/**
 * Meme logique de normalisation que l'import de medicaments (accents,
 * espaces multiples) — nécessaire ici pour retrouver le medicament par
 * son nom malgre de petites variations d'ecriture entre le fichier de
 * stock et le catalogue deja en base.
 */
function normaliserNom(nom: string): string {
  return nom
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
}

interface LigneEntree {
  nomMedicament: string
  numeroLot: string
  datePeremption: string
  quantite: string
  prixAchat: string
  [key: string]: string
}

/**
 * Parse une date au format JJ/MM/AAAA ou AAAA-MM-JJ (les deux formats les
 * plus probables selon que le fichier vient d'un export Excel francophone
 * ou d'un export ISO). Retourne null si aucun des deux formats ne marche.
 */
function parserDate(valeur: string): Date | null {
  const v = valeur.trim()
  if (/^\d{4}-\d{2}-\d{2}/.test(v)) {
    const d = new Date(v)
    return Number.isNaN(d.getTime()) ? null : d
  }
  const matchFr = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (matchFr) {
    const [, jour, mois, annee] = matchFr
    const d = new Date(Number(annee), Number(mois) - 1, Number(jour))
    return Number.isNaN(d.getTime()) ? null : d
  }
  return null
}

/**
 * Valide une ligne sans toucher la base. La verification "medicament
 * introuvable" se fait separement (necessite le catalogue complet).
 */
function validerLigne(valeurs: LigneEntree): string | null {
  if (!valeurs.nomMedicament || valeurs.nomMedicament.trim() === '') {
    return 'Nom du medicament manquant'
  }
  if (!valeurs.quantite || valeurs.quantite.trim() === '') {
    return 'Quantite manquante'
  }
  const quantite = parseInt(valeurs.quantite, 10)
  if (Number.isNaN(quantite) || quantite <= 0) {
    return 'Quantite invalide'
  }
  if (!valeurs.datePeremption || valeurs.datePeremption.trim() === '') {
    return 'Date de peremption manquante'
  }
  if (!parserDate(valeurs.datePeremption)) {
    return 'Date de peremption invalide (format attendu : JJ/MM/AAAA)'
  }
  if (valeurs.prixAchat && valeurs.prixAchat.trim() !== '') {
    const prixAchat = parseFloat(valeurs.prixAchat.replace(',', '.'))
    if (Number.isNaN(prixAchat) || prixAchat < 0) {
      return 'Prix d\'achat invalide'
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

  // ─── Catalogue de la pharmacie, pour associer chaque ligne a un medicament existant ──
  const medicamentsExistants = await prisma.medicament.findMany({
    where: { pharmacieId, actif: true },
    select: { id: true, nom: true },
  })
  const medicamentsParNom = new Map(
    medicamentsExistants.map((m) => [normaliserNom(m.nom), m.id])
  )

  if (mode === 'preview') {
    const lignes: LigneEntree[] = body.lignes || []
    if (lignes.length === 0) return apiError('Aucune ligne a valider', 400)
    if (lignes.length > MAX_LIGNES) {
      return apiError(`Trop de lignes (max ${MAX_LIGNES})`, 400)
    }

    const resultats: LignePreview[] = lignes.map((valeurs, index) => {
      const erreur = validerLigne(valeurs)
      if (erreur) {
        return { index, valeurs, statut: 'erreur', message: erreur }
      }

      const nomNormalise = normaliserNom(valeurs.nomMedicament)
      if (!medicamentsParNom.has(nomNormalise)) {
        return {
          index,
          valeurs,
          statut: 'erreur',
          message: `Medicament "${valeurs.nomMedicament}" introuvable — importez-le d'abord ou verifiez l'orthographe`,
        }
      }

      // Pas de notion de "doublon" pour un lot : plusieurs livraisons du
      // meme medicament sont normales et attendues (numeros de lot
      // differents, dates de peremption differentes).
      return { index, valeurs, statut: 'ok' }
    })

    return apiSuccess({ lignes: resultats })
  }

  // ─── mode === 'confirm' ────────────────────────────────────────────────
  const lignes: { valeurs: LigneEntree; action: 'creer' | 'ignorer' }[] = body.lignes || []
  if (lignes.length === 0) return apiError('Aucune ligne a importer', 400)
  if (lignes.length > MAX_LIGNES) {
    return apiError(`Trop de lignes (max ${MAX_LIGNES})`, 400)
  }

  let crees = 0
  const ignores = 0
  let erreurs = 0

  await prisma.$transaction(async (tx) => {
    for (const { valeurs, action } of lignes) {
      if (action === 'ignorer') continue

      const erreurValidation = validerLigne(valeurs)
      const nomNormalise = normaliserNom(valeurs.nomMedicament)
      const medicamentId = medicamentsParNom.get(nomNormalise)

      if (erreurValidation || !medicamentId) {
        erreurs++
        continue
      }

      const datePeremption = parserDate(valeurs.datePeremption)!
      const quantite = parseInt(valeurs.quantite, 10)
      const prixAchat = valeurs.prixAchat?.trim()
        ? parseFloat(valeurs.prixAchat.replace(',', '.'))
        : null

      await tx.lot.create({
        data: {
          medicamentId,
          pharmacieId,
          numeroLot: valeurs.numeroLot?.trim() || null,
          quantite,
          prixAchat,
          datePeremption,
        },
      })

      await tx.mouvementStock.create({
        data: {
          type: 'ENTREE',
          quantite,
          medicamentId,
          userId: session.user.id,
        },
      })

      crees++
    }
  })

  await createAuditLog({
    action: 'IMPORT_STOCK',
    details: { crees, ignores, erreurs, total: lignes.length },
    userId: session.user.id,
    pharmacieId,
  })

  return apiSuccess({ crees, misAJour: 0, ignores, erreurs })
}