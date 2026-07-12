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

/**
 * Normalise un numero de telephone pour la comparaison : ne garde que les
 * chiffres, retire l'indicatif Guinee (+224) s'il est present pour unifier
 * les formats locaux et internationaux du meme numero.
 */
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
  if (valeurs.email && valeurs.email.trim() !== '' && !EMAIL_REGEX.test(valeurs.email.trim())) {
    return 'Email invalide'
  }
  return null
}

type Existants = Map<string, { id: string; nom: string }>

/**
 * Detection de doublon pour des CLIENTS (personnes physiques) :
 *
 * Telephone ET email sont des signaux fiables pour identifier une personne
 * — deux personnes differentes n'ont normalement jamais le meme numero ni
 * la meme adresse email. Le NOM SEUL n'est PAS fiable en contexte guineen :
 * les patronymes tres courants (Camara, Sylla, Soumah, Diallo, Bah, Barry,
 * Conde, Toure...) se repetent constamment entre personnes totalement
 * differentes. Bloquer ou fusionner sur la seule base du nom creerait des
 * faux doublons en masse et rendrait l'import inutilisable.
 *
 * Regle appliquee :
 * - Telephone OU email fourni ET correspond a un client existant (ou a une
 *   autre ligne du meme fichier) -> DOUBLON (signal fort, fiable)
 * - Telephone et/ou email fournis mais differents de tout ce qui existe ->
 *   OK, meme si le nom est identique a quelqu'un d'autre (un identifiant
 *   distinct est une preuve suffisante que c'est une personne differente)
 * - Ni telephone ni email fournis -> seul le nom peut etre compare, ce qui
 *   n'est PAS fiable -> AVERTISSEMENT seulement (visible, mais n'empeche
 *   pas la creation ; jamais traite comme un vrai doublon)
 */
function detecterCorrespondanceClient(
  valeurs: LigneEntree,
  parTelephone: Existants,
  parEmail: Existants,
  parNom: Existants,
  telsVusDansFichier: Map<string, number>,
  emailsVusDansFichier: Map<string, number>,
  nomsVusDansFichier: Map<string, number>,
  index: number
): { statut: 'ok' | 'doublon' | 'avertissement'; message?: string; idExistant?: string } {
  const telNorm = valeurs.telephone?.trim() ? normaliserTelephone(valeurs.telephone) : ''
  const emailNorm = valeurs.email?.trim() ? normaliserEmail(valeurs.email) : ''
  const nomNorm = normaliserNom(valeurs.nom)

  if (telNorm) {
    const existant = parTelephone.get(telNorm)
    if (existant) {
      return { statut: 'doublon', message: `Meme telephone qu'un client existant (${existant.nom})`, idExistant: existant.id }
    }
    const ligneFichier = telsVusDansFichier.get(telNorm)
    if (ligneFichier !== undefined && ligneFichier !== index) {
      return { statut: 'doublon', message: 'Meme telephone qu\'une autre ligne du fichier' }
    }
  }

  if (emailNorm) {
    const existant = parEmail.get(emailNorm)
    if (existant) {
      return { statut: 'doublon', message: `Meme email qu'un client existant (${existant.nom})`, idExistant: existant.id }
    }
    const ligneFichier = emailsVusDansFichier.get(emailNorm)
    if (ligneFichier !== undefined && ligneFichier !== index) {
      return { statut: 'doublon', message: 'Meme email qu\'une autre ligne du fichier' }
    }
  }

  if (telNorm || emailNorm) {
    // Au moins un identifiant fiable est fourni et ne correspond a rien de
    // connu : preuve suffisante, on ne remet pas en cause meme si le nom
    // ressemble a quelqu'un d'autre.
    return { statut: 'ok' }
  }

  // Ni telephone ni email : seul le nom peut etre compare, donc
  // avertissement (jamais bloquant) plutot que doublon.
  const existantParNom = parNom.get(nomNorm)
  if (existantParNom) {
    return {
      statut: 'avertissement',
      message: `Un client "${existantParNom.nom}" existe deja sans telephone/email a comparer — verifie qu'il ne s'agit pas de la meme personne`,
    }
  }
  const ligneFichierNom = nomsVusDansFichier.get(nomNorm)
  if (ligneFichierNom !== undefined && ligneFichierNom !== index) {
    return {
      statut: 'avertissement',
      message: 'Meme nom qu\'une autre ligne du fichier, sans telephone/email pour confirmer',
    }
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

  const clientsExistants = await prisma.client.findMany({
    where: { pharmacieId, actif: true },
    select: { id: true, nom: true, telephone: true, email: true },
  })
  const parTelephone: Existants = new Map()
  const parEmail: Existants = new Map()
  const parNom: Existants = new Map()
  for (const c of clientsExistants) {
    if (c.telephone) {
      const t = normaliserTelephone(c.telephone)
      if (t) parTelephone.set(t, { id: c.id, nom: c.nom })
    }
    if (c.email) {
      parEmail.set(normaliserEmail(c.email), { id: c.id, nom: c.nom })
    }
    parNom.set(normaliserNom(c.nom), { id: c.id, nom: c.nom })
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
      if (!tel && !email) {
        const nom = normaliserNom(valeurs.nom)
        if (nom && !nomsVusDansFichier.has(nom)) nomsVusDansFichier.set(nom, index)
      }
    })

    const resultats: LignePreview[] = lignes.map((valeurs, index) => {
      const erreur = validerLigne(valeurs)
      if (erreur) {
        return { index, valeurs, statut: 'erreur', message: erreur }
      }

      const correspondance = detecterCorrespondanceClient(
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

      const telNorm = valeurs.telephone?.trim() ? normaliserTelephone(valeurs.telephone) : ''
      const emailNorm = valeurs.email?.trim() ? normaliserEmail(valeurs.email) : ''
      const idExistant =
        (telNorm ? parTelephone.get(telNorm)?.id : undefined) ??
        (emailNorm ? parEmail.get(emailNorm)?.id : undefined)

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
    },
    { timeout: 60000, maxWait: 10000 }
  )

  await createAuditLog({
    action: 'IMPORT_CLIENTS',
    details: { crees, misAJour, ignores, erreurs, total: lignes.length },
    userId: session.user.id,
    pharmacieId,
  })

  return apiSuccess({ crees, misAJour, ignores, erreurs })
}