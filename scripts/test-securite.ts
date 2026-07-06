/**
 * Tests de sécurité HTTP — PharmaGest
 *
 * Usage :
 *   npx ts-node --project scripts/tsconfig.json scripts/test-securite.ts https://pharmagest-zeta.vercel.app
 *   npx tsx scripts/test-securite.ts https://pharmagest-zeta.vercel.app
 *
 * Prérequis : Node 18+ (fetch natif), seed de base exécuté.
 */

const BASE_URL = process.argv[2]?.replace(/\/$/, '')
if (!BASE_URL) {
  console.error('\nUsage : npx tsx scripts/test-securite.ts <BASE_URL>\n')
  process.exit(1)
}

// ── Credentials depuis prisma/seed.ts ────────────────────────────────────────
const CREDS = {
  admin:    { email: 'admin@pharmaciecentrale.gn',    password: 'Admin1234!'    },
  caissier: { email: 'caissier@pharmaciecentrale.gn', password: 'Caissier1234!' },
  invalide: { email: 'pirate@test.com',               password: 'WrongPass999!' },
}

// ── Types ─────────────────────────────────────────────────────────────────────
interface Verdict { ok: boolean; detail: string }
const pass  = (detail: string): Verdict => ({ ok: true,  detail })
const echec = (detail: string): Verdict => ({ ok: false, detail })

function afficher(n: number, label: string, v: Verdict) {
  const icone = v.ok ? '✅' : '❌'
  console.log(`${icone} TEST ${n} — ${label}`)
  console.log(`   └─ ${v.detail}\n`)
}

// ── Authentification NextAuth (Credentials + JWT) ────────────────────────────
async function login(email: string, password: string): Promise<string | null> {
  // Étape 1 : récupérer le CSRF token (obligatoire par NextAuth)
  const csrfRes = await fetch(`${BASE_URL}/api/auth/csrf`)
  if (!csrfRes.ok) return null
  const { csrfToken } = (await csrfRes.json()) as { csrfToken: string }

  // Étape 2 : s'authentifier via le callback credentials
  const body = new URLSearchParams({
    csrfToken,
    email,
    password,
    redirect:    'false',
    callbackUrl: '/',
    json:        'true',
  })

  const authRes = await fetch(`${BASE_URL}/api/auth/callback/credentials`, {
    method:   'POST',
    headers:  { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:     body.toString(),
    redirect: 'manual', // ne pas suivre la redirection — on veut le Set-Cookie
  })

  // Étape 3 : extraire le cookie de session (HTTP ou HTTPS)
  const setCookie = authRes.headers.get('set-cookie') ?? ''

  // NextAuth nomme le cookie différemment selon HTTP/HTTPS :
  //   HTTP  → next-auth.session-token
  //   HTTPS → __Secure-next-auth.session-token
  const match = setCookie.match(/(?:__Secure-)?next-auth\.session-token=([^;]+)/)
  if (!match) return null

  const nomCookie = setCookie.includes('__Secure-next-auth.session-token')
    ? '__Secure-next-auth.session-token'
    : 'next-auth.session-token'

  return `${nomCookie}=${match[1]}`
}

function headers(cookie: string): Record<string, string> {
  return { Cookie: cookie }
}

// ── TEST 1 — Sans token → 401 ────────────────────────────────────────────────
async function test1(): Promise<Verdict> {
  const res = await fetch(`${BASE_URL}/api/clients`)
  if (res.status === 401) {
    return pass(`/api/clients sans token → HTTP 401 ✓`)
  }
  return echec(`HTTP ${res.status} reçu, 401 attendu — l'endpoint n'exige pas de session`)
}

// ── TEST 2 — CAISSIER sur route Admin → 403 ───────────────────────────────────
async function test2(): Promise<Verdict> {
  const cookie = await login(CREDS.caissier.email, CREDS.caissier.password)
  if (!cookie) {
    return echec(
      `Login CAISSIER échoué (${CREDS.caissier.email}) — ` +
      `vérifier que le seed est exécuté en base de données`
    )
  }

  const routes = ['/api/rapports', '/api/audit', '/api/users']
  const resultats: string[] = []
  let tousBloqués = true

  for (const route of routes) {
    const res = await fetch(`${BASE_URL}${route}`, { headers: headers(cookie) })
    const statut = res.status
    resultats.push(`${route} → ${statut}`)
    if (statut !== 403) tousBloqués = false
  }

  if (tousBloqués) {
    return pass(`CAISSIER bloqué sur toutes les routes admin : ${resultats.join(' | ')}`)
  }
  return echec(
    `Certaines routes admin accessibles par un CAISSIER : ${resultats.join(' | ')}`
  )
}

// ── TEST 3 — Isolation multi-tenant → 404 ────────────────────────────────────
async function test3(): Promise<Verdict> {
  const cookie = await login(CREDS.admin.email, CREDS.admin.password)
  if (!cookie) {
    return echec(`Login ADMIN échoué (${CREDS.admin.email}) — vérifier le seed`)
  }

  // UUID bien formé mais qui n'appartient pas à cette pharmacie
  const idEtrangere = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'

  const endpoints = [
    `/api/clients/${idEtrangere}`,
    `/api/medicaments/${idEtrangere}`,
  ]
  const resultats: string[] = []
  let tousBloqués = true

  for (const ep of endpoints) {
    const res = await fetch(`${BASE_URL}${ep}`, { headers: headers(cookie) })
    resultats.push(`${ep} → ${res.status}`)
    if (res.status === 200) {
      tousBloqués = false
    }
  }

  if (tousBloqués) {
    return pass(`Ressources étrangères inaccessibles : ${resultats.join(' | ')}`)
  }
  return echec(
    `HTTP 200 reçu sur un ID étranger — le filtrage pharmacieId n'est pas appliqué. ` +
    `Détails : ${resultats.join(' | ')}`
  )
}

// ── TEST 4 — Protection brute-force ──────────────────────────────────────────
async function test4(): Promise<Verdict> {
  const NB_TENTATIVES = 10
  const statuts: number[] = []
  const temps:   number[] = []

  // Récupérer un CSRF token valide une seule fois
  const csrfRes = await fetch(`${BASE_URL}/api/auth/csrf`)
  const { csrfToken } = (await csrfRes.json()) as { csrfToken: string }

  for (let i = 0; i < NB_TENTATIVES; i++) {
    const t0  = Date.now()
    const res = await fetch(`${BASE_URL}/api/auth/callback/credentials`, {
      method:   'POST',
      headers:  { 'Content-Type': 'application/x-www-form-urlencoded' },
      body:     new URLSearchParams({
        csrfToken,
        email:       CREDS.invalide.email,
        password:    `MauvaisMotDePasse_${i}`,
        redirect:    'false',
        callbackUrl: '/',
      }).toString(),
      redirect: 'manual',
    })
    statuts.push(res.status)
    temps.push(Date.now() - t0)
  }

  const nb429 = statuts.filter((s) => s === 429).length

  if (nb429 > 0) {
    return pass(
      `Rate limiting actif — ${nb429}/${NB_TENTATIVES} réponses 429. ` +
      `Statuts : ${statuts.join(', ')}`
    )
  }

  const tMoyen  = Math.round(temps.reduce((a, b) => a + b, 0) / temps.length)
  const tPremier = temps[0]
  const tDernier = temps[NB_TENTATIVES - 1]
  const ralenti  = tDernier > tPremier * 3

  if (ralenti) {
    return pass(
      `Ralentissement progressif détecté — ` +
      `${tPremier}ms → ${tDernier}ms (×${Math.round(tDernier / tPremier)})`
    )
  }

  return echec(
    `Aucun rate limiting détecté après ${NB_TENTATIVES} tentatives. ` +
    `Statuts : ${statuts.join(', ')} — Temps moyen : ${tMoyen}ms. ` +
    `⚠️  Recommandé : ajouter @upstash/ratelimit sur /api/auth/callback/credentials`
  )
}

// ── Runner ────────────────────────────────────────────────────────────────────
const TESTS: Array<{ n: number; label: string; fn: () => Promise<Verdict> }> = [
  { n: 1, label: 'Accès sans token (401 attendu)',                fn: test1 },
  { n: 2, label: 'CAISSIER sur routes Admin (403 attendu)',       fn: test2 },
  { n: 3, label: 'Isolation multi-tenant (404 attendu)',          fn: test3 },
  { n: 4, label: 'Protection brute-force (429 ou ralentissement)', fn: test4 },
]

async function main() {
  console.log(`\n🔍 Tests de sécurité HTTP — ${BASE_URL}\n`)
  console.log(`   Accounts : ${CREDS.admin.email} / ${CREDS.caissier.email}\n`)

  let nbOk = 0

  for (const t of TESTS) {
    try {
      const verdict = await t.fn()
      afficher(t.n, t.label, verdict)
      if (verdict.ok) nbOk++
    } catch (err) {
      afficher(t.n, t.label, echec(`Exception : ${(err as Error).message}`))
    }
  }

  const total = TESTS.length
  const emoji = nbOk === total ? '🟢' : nbOk >= total / 2 ? '🟡' : '🔴'
  console.log(`${emoji} Résultat : ${nbOk}/${total} tests passés\n`)
  process.exit(nbOk === total ? 0 : 1)
}

main()
