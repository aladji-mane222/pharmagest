import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiError, apiSuccess } from '@/lib/utils'
import { createAuditLog } from '@/lib/audit'
import type { LignePreview } from '@/components/ui/ImportModal'

const MAX_LIGNES = 5000
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

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

function normaliserEmail(email: string): string {
  return email.trim().toLowerCase()
}

interface LigneEntree {
  nom: string
  contact: string
  telephone: string
  email: string
  delaiLivraison: string
  [key: string]: string
}

function validerLigne(valeurs: LigneEntree): string | null {
  if (!valeurs.nom || valeurs.nom.trim() === '') {
    return 'Nom manquant'
  }
  if (valeurs.delaiLivraison && valeurs.delaiLivraison.trim() !== '') {
    const delai = parseInt(valeurs.delaiLivraison, 10)
    if (Number.isNaN(delai) || delai < 0) {
      return 'Delai de livraison invalide'
    }
  }
  if (valeurs.email && valeurs.email.trim() !== '' && !EMAIL_REGEX.test(valeurs.email.trim())) {
    return 'Email invalide'
  }
  return null
}

type Existants = Map<string, { id: string; nom: string }>

/**
 * Detection de doublon pour des FOURNISSEURS (entreprises) :
 *
 * Contrairement aux clients (personnes physiques, homonymes tres frequents
 * en Guinee), le nom d'une entreprise est un signal raisonnablement fiable
 * — deux fournisseurs distincts portant exactement le meme nom sont rares.
 * On combine donc trois signaux : telephone, email OU nom identique suffit
 * a declencher un doublon (telephone/email verifies en premier car plus
 * forts : ils attrapent aussi le cas d'une meme entreprise ecrite
 * differemment, ex: "Pharma Dist." vs "Pharma Distribution SA").
 */
function detecterCorrespondanceFournisseur(
  valeurs: LigneEntree,
  parTelephone: Existants,
  parEmail: Existants,
  parNom: Existants,
  telsVusDansFichier: Map<string, number>,
  emailsVusDansFichier: Map<string, number>,
  nomsVusDansFichier: Map<string, number>,
  index: number
): { statut: 'ok' | 'doublon'; message?: string; idExistant?: string } {
  const telNorm = valeurs.telephone?.trim() ? normaliserTelephone(valeurs.telephone) : ''
  const emailNorm = valeurs.email?.trim() ? normaliserEmail(valeurs.email) : ''
  const nomNorm = normaliserNom(valeurs.nom)

  if (telNorm) {
    const existant = parTelephone.get(telNorm)
    if (existant) {
      return { statut: 'doublon', message: `Meme telephone qu'un fournisseur existant (${existant.nom})`, idExistant: existant.id }
    }
    const ligneFichier = telsVusDansFichier.get(telNorm)
    if (ligneFichier !== undefined && ligneFichier !== index) {
      return { statut: 'doublon', message: 'Meme telephone qu\'une autre ligne du fichier' }
    }
  }

  if (emailNorm) {
    const existant = parEmail.get(emailNorm)
    if (existant) {
      return { statut: 'doublon', message: `Meme email qu'un fournisseur existant (${existant.nom})`, idExistant: existant.id }
    }
    const ligneFichier = emailsVusDansFichier.get(emailNorm)
    if (ligneFichier !== undefined && ligneFichier !== index) {
      return { statut: 'doublon', message: 'Meme email qu\'une autre ligne du fichier' }
    }
  }

  const existantParNom = parNom.get(nomNorm)
  if (existantParNom) {
    return { statut: 'doublon', message: `Deja present dans le fichier fournisseurs (${existantParNom.nom})`, idExistant: existantParNom.id }
  }
  const ligneFichierNom = nomsVusDansFichier.get(nomNorm)
  if (ligneFichierNom !== undefined && ligneFichierNom !== index) {
    return { statut: 'doublon', message: 'Doublon dans le fichier importe' }
  }

  return { statut: 'ok' }
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

  const fournisseursExistants = await prisma.fournisseur.findMany({
    where: { pharmacieId, actif: true },
    select: { id: true, nom: true, telephone: true, email: true },
  })
  const parTelephone: Existants = new Map()
  const parEmail: Existants = new Map()
  const parNom: Existants = new Map()
  for (const f of fournisseursExistants) {
    if (f.telephone) {
      const t = normaliserTelephone(f.telephone)
      if (t) parTelephone.set(t, { id: f.id, nom: f.nom })
    }
    if (f.email) {
      parEmail.set(normaliserEmail(f.email), { id: f.id, nom: f.nom })
    }
    parNom.set(normaliserNom(f.nom), { id: f.id, nom: f.nom })
  }

  if (mode === 'preview') {
    const lignes: LigneEntree[] = body.lignes || []
    if (lignes.length === 0) return apiError('Aucune ligne a valider', 400)
    if (lignes.length > MAX_LIGNES) {
      return apiError(`Trop de lignes (max ${MAX_LIGNES})`, 400)
    }

    const telsVusDansFichier = new Map<string, number>()
    const emailsVusDansFichier = new Map<string, number>()
    const nomsVusDansFichier = new Map<string, number>()
    lignes.forEach((valeurs, index) => {
      const tel = valeurs.telephone?.trim() ? normaliserTelephone(valeurs.telephone) : ''
      const email = valeurs.email?.trim() ? normaliserEmail(valeurs.email) : ''
      if (tel && !telsVusDansFichier.has(tel)) telsVusDansFichier.set(tel, index)
      if (email && !emailsVusDansFichier.has(email)) emailsVusDansFichier.set(email, index)
      const nom = normaliserNom(valeurs.nom)
      if (nom && !nomsVusDansFichier.has(nom)) nomsVusDansFichier.set(nom, index)
    })

    const resultats: LignePreview[] = lignes.map((valeurs, index) => {
      const erreur = validerLigne(valeurs)
      if (erreur) {
        return { index, valeurs, statut: 'erreur', message: erreur }
      }

      const correspondance = detecterCorrespondanceFournisseur(
        valeurs, parTelephone, parEmail, parNom,
        telsVusDansFichier, emailsVusDansFichier, nomsVusDansFichier, index
      )
      return { index, valeurs, statut: correspondance.statut, message: correspondance.message }
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

      const telNorm = valeurs.telephone?.trim() ? normaliserTelephone(valeurs.telephone) : ''
      const emailNorm = valeurs.email?.trim() ? normaliserEmail(valeurs.email) : ''
      const nomNorm = normaliserNom(valeurs.nom)
      const idExistant =
        (telNorm ? parTelephone.get(telNorm)?.id : undefined) ??
        (emailNorm ? parEmail.get(emailNorm)?.id : undefined) ??
        parNom.get(nomNorm)?.id

      const donnees = {
        nom: valeurs.nom.trim(),
        contact: valeurs.contact?.trim() || null,
        telephone: valeurs.telephone?.trim() || null,
        email: valeurs.email?.trim() || null,
        delaiLivraison: valeurs.delaiLivraison?.trim()
          ? parseInt(valeurs.delaiLivraison, 10)
          : null,
      }

      if (action === 'mettreAJour' && idExistant) {
        await tx.fournisseur.update({ where: { id: idExistant }, data: donnees })
        misAJour++
      } else {
        await tx.fournisseur.create({ data: { ...donnees, pharmacieId } })
        crees++
      }
    }
  })

  await createAuditLog({
    action: 'IMPORT_FOURNISSEURS',
    details: { crees, misAJour, ignores, erreurs, total: lignes.length },
    userId: session.user.id,
    pharmacieId,
  })

  return apiSuccess({ crees, misAJour, ignores, erreurs })
}