<#
.SYNOPSIS
    Tests de securite HTTP reels pour PharmaGest (tache 1.4).

.DESCRIPTION
    Fait de VRAIS appels HTTP (pas de simulation, pas de comparaison de count() Prisma)
    contre une instance en cours d'execution de l'app, pour verifier 3 scenarios :

    1. Un compte CAISSIER qui appelle une route reservee Admin (/api/rapports) -> doit recevoir 403
    2. Un appel sans aucune session/cookie vers une route protegee -> doit recevoir 401
    3. Un Admin de la pharmacie A qui appelle l'ID exact d'une ressource de la pharmacie B
       (/api/clients/client-demo-1, qui appartient a pharmacie-demo-001) -> doit recevoir 404,
       jamais les donnees, jamais un 403 qui confirmerait indirectement que la ressource existe.

    Comptes utilises (seed_demo.sql, README) :
      - Admin pharmacie pilote   : admin@pharmaciecentrale.gn / Admin1234!
      - Caissier pharmacie pilote: caissier@pharmaciecentrale.gn / Caissier1234!
      - Client de la pharmacie demo (pour le test 404) : client-demo-1

    Si tes mots de passe de seed different de ceux ci-dessus (changes depuis), passe-les
    en parametres -CaissierEmail/-CaissierPassword etc.

.PARAMETER BaseUrl
    URL de base de l'app a tester. Par defaut http://localhost:3000 (npm run dev).
    Peut aussi etre https://pharmagest-zeta.vercel.app pour tester la prod directement.

.EXAMPLE
    ./scripts/test-securite.ps1

.EXAMPLE
    ./scripts/test-securite.ps1 -BaseUrl "https://pharmagest-zeta.vercel.app"
#>

param(
    [string]$BaseUrl = "http://localhost:3000",

    [string]$CaissierEmail = "caissier@pharmaciecentrale.gn",
    [string]$CaissierPassword = "Caissier1234!",

    [string]$AdminEmail = "admin@pharmaciecentrale.gn",
    [string]$AdminPassword = "Admin1234!",

    [string]$ClientIdAutrePharmacie = "client-demo-1",

    [switch]$SkipRateLimitTest
)

$ErrorActionPreference = "Stop"
$script:Resultats = @()

function Add-Resultat {
    param(
        [string]$Nom,
        [int]$Attendu,
        [Nullable[int]]$Obtenu,
        [string]$Details
    )
    $statut = if ($Obtenu -eq $Attendu) { "OK" } else { "ECHEC" }
    $script:Resultats += [PSCustomObject]@{
        Test    = $Nom
        Attendu = $Attendu
        Obtenu  = if ($null -eq $Obtenu) { "aucune reponse / erreur reseau" } else { $Obtenu }
        Statut  = $statut
        Details = $Details
    }
}

function Get-StatusCode {
    param($ErrorRecord)
    try {
        if ($ErrorRecord.Exception.Response) {
            return [int]$ErrorRecord.Exception.Response.StatusCode
        }
    } catch {}
    try {
        return [int]$ErrorRecord.Exception.Response.StatusCode.value__
    } catch {}
    return $null
}

function New-AuthSession {
    param([string]$Email, [string]$Password)

    $session = $null
    $csrfResp = Invoke-RestMethod -Uri "$BaseUrl/api/auth/csrf" -Method Get -SessionVariable session

    if (-not $csrfResp.csrfToken) {
        throw "Impossible de recuperer le csrfToken depuis $BaseUrl/api/auth/csrf. L'app est-elle bien demarree ?"
    }

    $body = @{
        csrfToken = $csrfResp.csrfToken
        email     = $Email
        password  = $Password
        json      = "true"
    }

    try {
        Invoke-WebRequest -Uri "$BaseUrl/api/auth/callback/credentials" `
            -Method Post -WebSession $session -Body $body `
            -ContentType "application/x-www-form-urlencoded" `
            -UseBasicParsing -MaximumRedirection 5 | Out-Null
    } catch {
        # Certaines configs renvoient un code gere comme "erreur" par PowerShell
        # malgre un cookie de session valide. On verifie la validite juste apres.
    }

    return $session
}

function Test-SessionValide {
    param($Session)
    try {
        $result = Invoke-RestMethod -Uri "$BaseUrl/api/auth/session" -Method Get -WebSession $Session
        return [bool]$result.user
    } catch {
        return $false
    }
}

function Invoke-TentativeConnexion {
    <#
        Fait une tentative de connexion isolee (nouvelle session/cookie a chaque fois)
        et retourne $true si la connexion a reussi, $false sinon.
        Le rate limiting cote serveur est indexe sur email+IP, pas sur le cookie,
        donc utiliser une session fraiche a chaque appel simule bien N utilisateurs
        differents qui retenteraient depuis la meme IP, ce qui est le cas reel vise.
    #>
    param([string]$Email, [string]$Password)
    $s = New-AuthSession -Email $Email -Password $Password
    return Test-SessionValide -Session $s
}

Write-Host "=== Tests de securite HTTP reels - PharmaGest ===" -ForegroundColor Cyan
Write-Host "Cible : $BaseUrl`n"

Write-Host "Connexion du compte CAISSIER ($CaissierEmail)..." -ForegroundColor Yellow
$sessionCaissier = New-AuthSession -Email $CaissierEmail -Password $CaissierPassword
$caissierOk = Test-SessionValide -Session $sessionCaissier
if (-not $caissierOk) {
    Write-Host "  ATTENTION : la session CAISSIER ne semble pas valide (mauvais mot de passe seed ?)." -ForegroundColor Red
    Write-Host "  Le test 1 (403) ne sera pas fiable si cette session a echoue." -ForegroundColor Red
} else {
    Write-Host "  Session CAISSIER active." -ForegroundColor Green
}

Write-Host "Connexion du compte ADMIN pharmacie pilote ($AdminEmail)..." -ForegroundColor Yellow
$sessionAdmin = New-AuthSession -Email $AdminEmail -Password $AdminPassword
$adminOk = Test-SessionValide -Session $sessionAdmin
if (-not $adminOk) {
    Write-Host "  ATTENTION : la session ADMIN ne semble pas valide (mauvais mot de passe seed ?)." -ForegroundColor Red
    Write-Host "  Le test 3 (404 multi-tenant) ne sera pas fiable si cette session a echoue." -ForegroundColor Red
} else {
    Write-Host "  Session ADMIN active.`n" -ForegroundColor Green
}

Write-Host "Test 1/4 : CAISSIER -> GET /api/rapports (route reservee Admin)..." -ForegroundColor Yellow
try {
    $resp = Invoke-WebRequest -Uri "$BaseUrl/api/rapports?type=ventes" -Method Get -WebSession $sessionCaissier -UseBasicParsing
    Add-Resultat -Nom "CAISSIER vers /api/rapports" -Attendu 403 -Obtenu $resp.StatusCode `
        -Details "Reponse recue sans erreur HTTP, code $($resp.StatusCode). Devrait etre 403."
} catch {
    $code = Get-StatusCode $_
    Add-Resultat -Nom "CAISSIER vers /api/rapports" -Attendu 403 -Obtenu $code `
        -Details "Erreur HTTP interceptee, code $code."
}

Write-Host "Test 2/4 : sans session -> GET /api/clients (route protegee)..." -ForegroundColor Yellow
try {
    $resp = Invoke-WebRequest -Uri "$BaseUrl/api/clients" -Method Get -UseBasicParsing
    Add-Resultat -Nom "Sans session vers /api/clients" -Attendu 401 -Obtenu $resp.StatusCode `
        -Details "Reponse recue sans erreur HTTP, code $($resp.StatusCode). Devrait etre 401."
} catch {
    $code = Get-StatusCode $_
    Add-Resultat -Nom "Sans session vers /api/clients" -Attendu 401 -Obtenu $code `
        -Details "Erreur HTTP interceptee, code $code."
}

Write-Host "Test 3/4 : ADMIN pharmacie pilote -> GET /api/clients/$ClientIdAutrePharmacie (appartient a pharmacie-demo-001)..." -ForegroundColor Yellow
try {
    $resp = Invoke-WebRequest -Uri "$BaseUrl/api/clients/$ClientIdAutrePharmacie" -Method Get -WebSession $sessionAdmin -UseBasicParsing
    Add-Resultat -Nom "Admin pharmacie A vers client de pharmacie B" -Attendu 404 -Obtenu $resp.StatusCode `
        -Details "ALERTE : la ressource d'une autre pharmacie a ete retournee avec le code $($resp.StatusCode) !"
} catch {
    $code = Get-StatusCode $_
    Add-Resultat -Nom "Admin pharmacie A vers client de pharmacie B" -Attendu 404 -Obtenu $code `
        -Details "Erreur HTTP interceptee, code $code."
}

if (-not $SkipRateLimitTest) {
    Write-Host ""
    Write-Host "Test 4/4 : rate limiting sur la connexion (compte $CaissierEmail)..." -ForegroundColor Yellow
    Write-Host "  ATTENTION : ce test va volontairement echouer 5 connexions puis en retenter une" -ForegroundColor DarkYellow
    Write-Host "  avec le BON mot de passe. Le compte $CaissierEmail restera bloque environ 5 minutes" -ForegroundColor DarkYellow
    Write-Host "  apres ce test (limite en memoire du serveur de dev). Utilise -SkipRateLimitTest pour l'eviter." -ForegroundColor DarkYellow
    Write-Host ""

    $mauvaisMotDePasse = "MotDePasseIncorrect_$(Get-Random)"
    $echecsAttendus = 0
    for ($i = 1; $i -le 5; $i++) {
        Write-Host "  Tentative $i/5 avec un mauvais mot de passe..." -ForegroundColor DarkGray
        $ok = Invoke-TentativeConnexion -Email $CaissierEmail -Password $mauvaisMotDePasse
        if (-not $ok) { $echecsAttendus++ }
        Start-Sleep -Milliseconds 300
    }
    Write-Host "  -> $echecsAttendus/5 tentatives ont bien echoue (attendu : 5/5, mot de passe volontairement faux)."

    Write-Host "  Tentative 6 avec le BON mot de passe (doit maintenant etre bloquee par le rate limit)..." -ForegroundColor DarkGray
    $connexionReussie = Invoke-TentativeConnexion -Email $CaissierEmail -Password $CaissierPassword

    if ($connexionReussie) {
        Add-Resultat -Nom "Rate limiting apres 5 echecs (6e tentative, bon mot de passe)" -Attendu 0 -Obtenu 1 `
            -Details "ECHEC : la connexion a reussi malgre 5 echecs precedents. Le rate limiting ne bloque pas."
    } else {
        Add-Resultat -Nom "Rate limiting apres 5 echecs (6e tentative, bon mot de passe)" -Attendu 0 -Obtenu 0 `
            -Details "OK : la connexion reste bloquee meme avec le bon mot de passe, le rate limiting fonctionne."
    }
} else {
    Write-Host "Test 4/4 (rate limiting) ignore (-SkipRateLimitTest)." -ForegroundColor DarkGray
}

Write-Host "`n=== Resultats ===" -ForegroundColor Cyan
$script:Resultats | Format-Table -AutoSize

$echecs = $script:Resultats | Where-Object { $_.Statut -eq "ECHEC" }
if ($echecs.Count -gt 0) {
    Write-Host "$($echecs.Count) test(s) EN ECHEC - voir le tableau ci-dessus." -ForegroundColor Red
} else {
    Write-Host "Les 3 tests sont conformes (403 / 401 / 404 obtenus)." -ForegroundColor Green
}

Write-Host "`n=== Bloc a coller dans JOURNAL.md ===" -ForegroundColor Cyan
$dateJour = Get-Date -Format "dd/MM/yyyy HH:mm"
Write-Host "### Test securite HTTP reel - $dateJour (contre $BaseUrl)"
foreach ($r in $script:Resultats) {
    Write-Host "- $($r.Test) : attendu $($r.Attendu), obtenu $($r.Obtenu) -> $($r.Statut)"
}