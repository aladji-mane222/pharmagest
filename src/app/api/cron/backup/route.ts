import { createHash } from 'crypto'
import { prisma } from '@/lib/prisma'
import { apiError, apiSuccess } from '@/lib/utils'

// ── Types B2 ─────────────────────────────────────────────────────────────────

interface B2Auth {
  authorizationToken: string
  apiUrl:             string
}

interface B2UploadUrl {
  uploadUrl:          string
  authorizationToken: string
}

// ── Backblaze B2 HTTP API (natif, pas de SDK) ─────────────────────────────────

async function b2Authorize(): Promise<B2Auth> {
  // Les clés ne sont jamais loggées — uniquement utilisées dans ce header
  const credentials = Buffer.from(
    `${process.env.B2_KEY_ID}:${process.env.B2_APPLICATION_KEY}`
  ).toString('base64')

  const res = await fetch('https://api.backblazeb2.com/b2api/v2/b2_authorize_account', {
    headers: { Authorization: `Basic ${credentials}` },
  })
  if (!res.ok) throw new Error(`b2_authorize_account HTTP ${res.status}`)
  return res.json() as Promise<B2Auth>
}

async function b2GetUploadUrl(auth: B2Auth): Promise<B2UploadUrl> {
  const res = await fetch(`${auth.apiUrl}/b2api/v2/b2_get_upload_url`, {
    method:  'POST',
    headers: {
      Authorization:  auth.authorizationToken,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ bucketId: process.env.B2_BUCKET_ID }),
  })
  if (!res.ok) throw new Error(`b2_get_upload_url HTTP ${res.status}`)
  return res.json() as Promise<B2UploadUrl>
}

async function b2Upload(
  uploadInfo: B2UploadUrl,
  nomFichier: string,
  contenu:    string
): Promise<number> {
  const buffer = Buffer.from(contenu, 'utf-8')
  const sha1   = createHash('sha1').update(buffer).digest('hex')

  const res = await fetch(uploadInfo.uploadUrl, {
    method:  'POST',
    headers: {
      Authorization:       uploadInfo.authorizationToken,
      'X-Bz-File-Name':    encodeURIComponent(nomFichier),
      'Content-Type':      'application/json',
      'Content-Length':    String(buffer.length),
      'X-Bz-Content-Sha1': sha1,
    },
    body: new Uint8Array(buffer),
  })

  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`b2_upload_file HTTP ${res.status}${detail ? ` — ${detail}` : ''}`)
  }

  return buffer.length
}

// ── Route cron ────────────────────────────────────────────────────────────────

interface ResultatPharmacie {
  pharmacieId:  string
  pharmacieNom: string
  fichier:      string
  tailleKo:     number
  statut:       'OK' | 'ERREUR'
  erreur?:      string
}

export async function GET(request: Request) {
  // ── Auth CRON_SECRET ────────────────────────────────────────────────────────
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return apiError('Non autorisé', 401)
  }

  // ── Vérification config B2 ──────────────────────────────────────────────────
  if (!process.env.B2_KEY_ID || !process.env.B2_APPLICATION_KEY || !process.env.B2_BUCKET_ID) {
    return apiError('Variables B2_KEY_ID / B2_APPLICATION_KEY / B2_BUCKET_ID manquantes', 500)
  }

  const maintenant = new Date()
  const debutMois  = new Date(maintenant.getFullYear(), maintenant.getMonth(), 1)

  // Format timestamp pour le nom de fichier : 2026-06-30T143022
  const timestamp = maintenant
    .toISOString()
    .replace('T', 'T')
    .replace(/:/g, '')
    .slice(0, 15)

  // ── Autorisation B2 (une seule fois pour toutes les pharmacies) ─────────────
  let b2Auth: B2Auth
  try {
    b2Auth = await b2Authorize()
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[Backup] Échec connexion B2:', msg)
    return apiError(`Connexion Backblaze B2 échouée : ${msg}`, 502)
  }

  const pharmacies = await prisma.pharmacie.findMany({
    where:  { licenceActive: true },
    select: { id: true, nom: true },
  })

  const resultats: ResultatPharmacie[] = []

  for (const pharmacie of pharmacies) {
    const nomFichier = `backup-${pharmacie.id}-${timestamp}.json`

    try {
      // ── Collecte des données critiques du mois en cours ───────────────────
      const [ventes, medicaments, depenses] = await Promise.all([
        prisma.vente.findMany({
          where:   { pharmacieId: pharmacie.id, createdAt: { gte: debutMois } },
          include: { lignes: { include: { medicament: { select: { nom: true } } } } },
          orderBy: { createdAt: 'desc' },
        }),
        prisma.medicament.findMany({
          where:   { pharmacieId: pharmacie.id, actif: true },
          include: { lots: { where: { actif: true }, select: { quantite: true, datePeremption: true, numeroLot: true } } },
        }),
        prisma.depense.findMany({
          where:   { pharmacieId: pharmacie.id, archivee: false, createdAt: { gte: debutMois } },
          orderBy: { createdAt: 'desc' },
        }),
      ])

      const payload = {
        meta: {
          backupDate:   maintenant.toISOString(),
          pharmacieId:  pharmacie.id,
          pharmacieNom: pharmacie.nom,
          periode:      maintenant.toISOString().slice(0, 7), // "2026-06"
        },
        stats: {
          ventes:      ventes.length,
          medicaments: medicaments.length,
          depenses:    depenses.length,
        },
        data: { ventes, medicaments, depenses },
      }

      const contenu = JSON.stringify(payload)

      // ── Upload B2 (un uploadUrl par pharmacie) ────────────────────────────
      const uploadInfo = await b2GetUploadUrl(b2Auth)
      const octets     = await b2Upload(uploadInfo, nomFichier, contenu)
      const tailleKo   = Math.round(octets / 1024)

      console.log(`[Backup] ✓ ${pharmacie.nom} → ${nomFichier} (${tailleKo} Ko)`)

      resultats.push({
        pharmacieId:  pharmacie.id,
        pharmacieNom: pharmacie.nom,
        fichier:      nomFichier,
        tailleKo,
        statut:       'OK',
      })

    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`[Backup] ✗ ${pharmacie.nom}:`, msg)

      resultats.push({
        pharmacieId:  pharmacie.id,
        pharmacieNom: pharmacie.nom,
        fichier:      nomFichier,
        tailleKo:     0,
        statut:       'ERREUR',
        erreur:       msg,
      })
    }
  }

  const nbOk      = resultats.filter((r) => r.statut === 'OK').length
  const nbErreurs = resultats.filter((r) => r.statut === 'ERREUR').length

  return apiSuccess({
    backupDate:    maintenant.toISOString(),
    pharmacies:    pharmacies.length,
    reussis:       nbOk,
    echoues:       nbErreurs,
    totalTailleKo: resultats.reduce((sum, r) => sum + r.tailleKo, 0),
    resultats,
  })
}
