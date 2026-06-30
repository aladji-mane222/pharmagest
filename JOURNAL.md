# JOURNAL DE SÉCURITÉ — PharmaGest
**Date d'audit :** 2026-06-30  
**Auditeur :** Claude Sonnet 4.6 (Session H Tâche 4)  
**Périmètre :** 26 routes API (hors cron — auth CRON_SECRET intentionnelle)  
**Méthode :** Analyse statique du code source (sans exécution)

---

## RÉSUMÉ EXÉCUTIF

| Résultat | Nombre |
|---|---|
| Routes entièrement sécurisées | 24 |
| **Failles confirmées** | **2** |
| Patterns risqués à décision produit | 3 |

**Bonne nouvelle :** Le modèle de sécurité multi-tenant est solide dans 92 % des cas. Les deux failles trouvées sont précises et corrigeables en une ligne chacune.

---

## TEST 1 — Isolation des données entre pharmacies (GET listes)

**Objectif :** Vérifier que les routes GET retournant des listes filtrent toujours par `pharmacieId` issu de la session (jamais du corps de requête).

| Route | Résultat |
|---|---|
| `GET /api/medicaments` | ✅ SQL `WHERE m."pharmacieId" = ${pharmacieId}` |
| `GET /api/ventes` | ✅ SQL `WHERE v."pharmacieId" = ${pharmacieId}` |
| `GET /api/clients` | ✅ `where: { pharmacieId }` Prisma ORM |
| `GET /api/depenses` | ✅ `where: { pharmacieId }` Prisma ORM |
| `GET /api/stock` | ✅ SQL `WHERE m."pharmacieId" = ${pharmacieId}` |
| `GET /api/stock/mouvements` | ✅ `medicament: { pharmacieId }` (relation imbriquée) |
| `GET /api/fournisseurs` | ✅ `where: { pharmacieId }` |
| `GET /api/commandes` | ✅ `where: { pharmacieId }` |
| `GET /api/inventaires` | ✅ SQL `WHERE i."pharmacieId" = ${pharmacieId}` |
| `GET /api/rapports` | ✅ tous les 4 types filtrent par `pharmacieId` |
| `GET /api/audit` | ✅ `where: { pharmacieId }` |
| `GET /api/dashboard` | ✅ toutes les requêtes ORM + SQL filtrées |

**Résultat global Test 1 : ✅ SÉCURISÉ**

---

## TEST 2 — Accès à une ressource d'une autre pharmacie via son ID

**Objectif :** Vérifier que `GET /api/X/[id_etranger]` retourne 404 et jamais les données d'une autre pharmacie.  
**Mécanisme attendu :** `prisma.X.findFirst({ where: { id, pharmacieId } })` — si null → 404.

| Route | Mécanisme | Résultat |
|---|---|---|
| `GET /api/medicaments/[id]` | `findFirst({ id, pharmacieId })` | ✅ 404 cross-tenant |
| `GET /api/ventes/[id]` | `findFirst({ id, pharmacieId })` | ✅ 404 cross-tenant |
| `GET /api/clients/[id]` | `findFirst({ id, pharmacieId })` | ✅ 404 cross-tenant |
| `GET /api/fournisseurs/[id]` | `findFirst({ id, pharmacieId })` | ✅ 404 cross-tenant |
| `GET /api/commandes/[id]` | `findFirst({ id, pharmacieId })` | ✅ 404 cross-tenant |
| `GET /api/inventaires/[id]` | `findFirst({ id, pharmacieId })` | ✅ 404 cross-tenant |
| `PATCH /api/lots/[id]` | `findFirst({ id, medicament: { pharmacieId } })` (relation) | ✅ 404 cross-tenant |
| `GET /api/parametres` | `findUnique({ id: session.user.pharmacieId })` (ID depuis session) | ✅ non-injectable |

**Résultat global Test 2 : ✅ SÉCURISÉ** (sauf faille dans PATCH inventaires/[id] — voir section Failles)

---

## TEST 3 — Accès sans token d'authentification → 401

**Objectif :** Toutes les routes doivent appeler `getServerSession(authOptions)` et retourner 401 si pas de session.

Toutes les 26 routes auditées commencent par :
```ts
const session = await getServerSession(authOptions)
if (!session) return apiError('Non autorisé', 401)
```

| Route | Résultat |
|---|---|
| Toutes les routes `/api/*` (hors `/api/cron/*`) | ✅ 401 sans session |
| `/api/cron/alertes` et `/api/cron/backup` | ✅ Auth CRON_SECRET intentionnelle (Vercel Cron n'a pas de session NextAuth) |

**Résultat global Test 3 : ✅ SÉCURISÉ**

---

## TEST 4 — Restrictions CAISSIER (rôle bas privilège)

**Objectif :** Le rôle CAISSIER ne peut pas modifier le catalogue, créer des dépenses admin, accéder aux rapports, ni annuler des ventes.

| Route | Check rôle | CAISSIER bloqué ? |
|---|---|---|
| `POST /api/medicaments` | `if (role !== 'ADMIN' && role !== 'PHARMACIEN')` | ✅ 403 |
| `PATCH /api/medicaments/[id]` | même check | ✅ 403 |
| `DELETE /api/medicaments/[id]` | même check | ✅ 403 |
| `POST /api/ventes/[id]/annuler` | `if (role === 'CAISSIER')` | ✅ 403 |
| `PATCH /api/clients/[id]` | check rôle | ✅ 403 |
| `DELETE /api/clients/[id]` | check rôle | ✅ 403 |
| `PATCH /api/depenses/[id]` | check rôle | ✅ 403 |
| `DELETE /api/depenses/[id]` | check rôle | ✅ 403 |
| `POST /api/lots` | check rôle | ✅ 403 |
| `PATCH /api/lots/[id]` | check rôle | ✅ 403 |
| `POST /api/fournisseurs` | check rôle | ✅ 403 |
| `PATCH /api/fournisseurs/[id]` | check rôle | ✅ 403 |
| `DELETE /api/fournisseurs/[id]` | check rôle | ✅ 403 |
| `POST /api/commandes` | check rôle | ✅ 403 |
| `PATCH /api/commandes/[id]` | check rôle | ✅ 403 |
| `POST /api/inventaires` | check rôle | ✅ 403 |
| `PATCH /api/inventaires/[id]` | check rôle | ✅ 403 |
| `GET /api/rapports` | check rôle | ✅ 403 |
| `PATCH /api/parametres` | check rôle | ✅ 403 |
| `GET /api/audit` | check rôle | ✅ 403 |
| `GET /api/users` | check rôle | ✅ 403 |
| `POST /api/users` | check ADMIN/SUPER_ADMIN strict | ✅ 403 |
| `POST /api/depenses` | pas de check CAISSIER | ✅ intentionnel (règle v2.4 : CAISSIER peut saisir) |
| `POST /api/ventes` | pas de check CAISSIER | ✅ intentionnel (rôle principal du CAISSIER) |

**Résultat global Test 4 : ✅ SÉCURISÉ** (avec 3 décisions produit à confirmer — voir section ci-dessous)

---

## ❌ FAILLE 1 — Cross-pharmacie sur clientId dans POST /api/ventes

**Criticité : HAUTE**  
**Fichier :** `src/app/api/ventes/route.ts` (recherche `findUnique` sur `clientId`)  
**Type :** Broken Object Level Authorization (OWASP API2)

### Description
Lors d'une vente à crédit, le code récupère le client via :
```ts
const clientPour = await prisma.client.findUnique({ where: { id: clientId } })
```
Le `clientId` vient du corps JSON de la requête. Il n'y a **aucun filtre `pharmacieId`**.

### Scénario d'attaque
1. L'utilisateur authentifié de la Pharmacie A connaît (ou devine) l'UUID d'un client de la Pharmacie B.
2. Il envoie `POST /api/ventes` avec `clientId: <uuid_pharmacie_B>` et `modePaiement: "PARTIELLE"`.
3. La vente est créée dans la Pharmacie A, mais le `soldeCredit` du client de la Pharmacie B est incrémenté.
4. Résultat : corruption des données financières d'une autre pharmacie.

### Correction attendue (À VALIDER avant implémentation)
Remplacer :
```ts
const clientPour = await prisma.client.findUnique({ where: { id: clientId } })
```
Par :
```ts
const clientPour = await prisma.client.findFirst({ where: { id: clientId, pharmacieId } })
```
Et vérifier que `clientPour` est non-null avant de continuer (retourner 404 sinon).

---

## ❌ FAILLE 2 — Lignes d'inventaire non validées dans PATCH /api/inventaires/[id]

**Criticité : MOYENNE**  
**Fichier :** `src/app/api/inventaires/[id]/route.ts` (action `saisir`)  
**Type :** Broken Object Property Level Authorization (OWASP API3)

### Description
Le PATCH avec `action: "saisir"` confirme d'abord que l'*inventaire* appartient à la bonne pharmacie, puis itère sur les `lignes` du corps de requête et fait :
```ts
await prisma.ligneInventaire.update({
  where: { id: ligne.id },  // ← ID non validé !
  data:  { quantiteReelle: ligne.quantiteReelle, motifEcart: ligne.motifEcart },
})
```
Il n'y a **aucune vérification que `ligne.id` appartient à cet inventaire**.

### Scénario d'attaque
1. L'utilisateur de la Pharmacie A ouvre un inventaire EN_COURS (le sien).
2. Il envoie `PATCH /api/inventaires/<son_id>` avec `lignes: [{ id: <uuid_ligne_pharmacie_B>, quantiteReelle: 0 }]`.
3. La ligne de stock d'une autre pharmacie est écrasée avec une quantité arbitraire.

### Correction attendue (À VALIDER avant implémentation)
Avant la boucle, extraire les IDs de lignes valides depuis l'inventaire chargé :
```ts
const idsValides = new Set(inventaire.lignes.map((l) => l.id))
for (const ligne of lignes) {
  if (!idsValides.has(ligne.id)) continue  // ou return apiError(403)
  await prisma.ligneInventaire.update(...)
}
```
Ou ajouter `inventaireId` au where de la mise à jour Prisma.

---

## ⚠️ DÉCISIONS PRODUIT REQUISES (pas des failles, mais à confirmer)

### Décision 1 — CAISSIER peut créer des clients
**Route :** `POST /api/clients` — pas de check rôle.  
**Question :** Un CAISSIER doit-il pouvoir créer un nouveau client lors d'une vente ? Si oui, c'est intentionnel. Si non, ajouter un check rôle.

### Décision 2 — CAISSIER peut enregistrer un remboursement de crédit
**Route :** `POST /api/clients/[id]/rembourser` — pas de check rôle.  
**Question :** Cette opération implique de l'argent. Doit-elle être réservée à PHARMACIEN/ADMIN ou un CAISSIER peut encaisser les remboursements ?

### Décision 3 — CAISSIER voit tous les clients avec leurs soldes
**Route :** `GET /api/clients?avecCredit=true` — pas de check rôle.  
**Question :** Un CAISSIER a-t-il besoin de voir la liste complète des crédits en cours ? Faible risque, mais expose des données financières au rôle de plus bas privilège.

---

## CONCLUSION

| Catégorie | Verdict |
|---|---|
| Isolation multi-tenant (listes) | ✅ Sécurisé |
| Accès cross-pharmacie par ID | ✅ Sécurisé (sauf Faille 2 sur lignes inventaire) |
| Authentification sans token | ✅ Sécurisé — 401 systématique |
| Restrictions CAISSIER | ✅ Sécurisé sur les opérations critiques |
| **Faille 1 — clientId non filtré (ventes)** | **❌ À CORRIGER** |
| **Faille 2 — ligneInventaire non validée** | **❌ À CORRIGER** |

Les deux failles sont de portée limitée (nécessitent un compte authentifié et la connaissance d'UUIDs étrangers), mais représentent de vraies violations du principe de séparation des tenants. Recommandation : corriger les deux avant le lancement en production.
