# PLAN DE CONSOLIDATION — PharmaGest → Vrai SaaS professionnel
**Créé le : 04/07/2026**
**Contexte : toutes les sessions A→I sont terminées, le MVP est fonctionnel et déployé. Ce plan ne "refait" rien — il consolide ce qui existe pour passer d'un statut "ça marche" à "ça inspire confiance".**

---

## Philosophie du plan

Un SaaS pro n'est pas défini par la quantité de fonctionnalités, mais par trois choses qu'une pharmacienne non technique ressent sans les nommer :
1. **Elle a confiance** — les chiffres sont justes, rien ne se perd, elle sait qui peut faire quoi.
2. **Elle va vite** — le geste répété 100 fois par jour (vendre, encaisser) ne la fait jamais réfléchir.
3. **Elle comprend tout de suite** — pas de jargon, pas d'écran vide sans explication, pas de bouton dont elle ignore l'effet.

L'esthétique (thème sombre, logo, joli design) vient **après** ces trois piliers, pas avant. C'est pourquoi ce plan diffère de l'ordre proposé par Copilot : le thème clair/sombre et le profil utilisateur sont des points de confort réels mais à faible impact — ils sont donc positionnés en Phase 6, pas en Phase 1.

### Ajout du 04/07/2026 — Polish UX ≠ profondeur fonctionnelle

L'audit réel de `/rapports` et `/fournisseurs/commandes` a révélé un piège dans la version initiale de ce plan : plusieurs tâches étaient formulées comme du *polish visuel* ("transformer en vraie vue de gestion", "recherche plus fluide") alors que le vrai problème était un **manque de contenu et de champs en base**, pas un manque d'habillage. Concrètement : `/rapports` n'a que 4 types de rapports (aucun sur les commandes), et `LigneCommande` n'a même pas de champ pour la quantité réellement reçue — impossible de détecter un écart de livraison, quel que soit le nombre de boutons stylés qu'on ajoute autour.

**Chaque phase ci-dessous distingue désormais explicitement deux catégories de tâches :**
- 🎨 **Polish UX** — présentation, cohérence visuelle, ergonomie d'un contenu qui existe déjà
- 🧱 **Profondeur fonctionnelle** — contenu, calculs ou champs qui n'existent pas du tout aujourd'hui, parfois nécessitant une migration de schéma

Un audit de ce type (comme celui fait sur rapports/commandes) doit être répété sur chaque module avant de le considérer "terminé" en Phase 5, plutôt que supposé.

---

## 📍 ÉTAT RÉEL AU 04/07/2026 (soir) — à lire avant de reprendre le travail

### Ce qui est fait et vérifié
- **Phase 0 — Fondations posées, mais PAS fermée.** Les 9 composants (`Button`, `Card`, `Badge`, `Modal`, `Toast`, `EmptyState`, `Skeleton`, `Input`/`Select`, `PageHeader`) sont créés et vérifiés (ESLint + TypeScript propres), les fondations design corrigées (couleurs de marque, fond, dark-mode boilerplate retiré), 2 optimisations de bundle livrées. Build de production confirmé propre par Nabé, à plusieurs reprises. **Mais en reprenant la checklist de sortie de Phase 0 le 04/07/2026, deux points ne sont pas satisfaits : `DESIGN-SYSTEM.md` n'a jamais été créé (les couleurs vivent seulement en commentaires dans `tailwind.config.ts`), et ni `Modal` ni `Toast` n'ont encore de cas d'usage réel dans l'app — ils existent mais ne remplacent encore aucun `confirm()`/`alert()`.** Phase 0 se fermera réellement au moment où les 13 `confirm()`/`alert()` de la Phase 1 seront traités, puisque ce sera leur premier usage concret.
- **Phase 1 — PAS COMMENCÉE.** Les 13 `confirm()`/`alert()` identifiés (Phase 1, tâche 1.2) n'ont **pas encore été remplacés**. La conversation est partie sur la chasse aux bugs avant d'y revenir.

### 🚨 Corrections d'urgence faites HORS plan, en cours de route (04/07/2026)
Ces bugs ont été découverts en testant Phase 0 et en auditant le repo suite aux retours de Nabé. Ils n'appartenaient à aucune phase — trop graves pour attendre. **Tous commités par Nabé le 04/07/2026 :**

| Bug | Gravité | Fichier | Statut |
|---|---|---|---|
| `clients/page.tsx` affichait le dashboard en double (merge du 03/07 corrompu) | 🔴 Critique — page entière inutilisable | `clients/page.tsx` | ✅ Corrigé (commit précédent) |
| `ventes/[id]/page.tsx` affichait le POS en double (même type de bug, commit différent) | 🔴 Critique — détail vente inaccessible | `ventes/[id]/page.tsx` | ✅ Corrigé (`0e02b8a`) |
| `/stock` plantait au clic sur un médicament (déstructuration supprimait `lots` de la réponse API) | 🔴 Critique — page inutilisable | `api/stock/route.ts` | ✅ Corrigé (`133e96f`) |
| Bénéfice net = CA − Dépenses seulement, **CMV jamais soustrait** | 🔴 Critique — chiffre financier faux affiché à la pharmacienne | `api/rapports/route.ts` | ✅ Corrigé (`241c15d`) |
| Vente à crédit total (`montantPaye: "0"`) traitée comme entièrement payée (bug falsy-zero JS), plafond jamais vérifié, solde jamais incrémenté | 🔴 Critique — risque financier réel pour la pharmacie | `api/ventes/route.ts` | ✅ Corrigé (`ece3b7d`) |
| Export Excel/CSV : objets imbriqués (`user.nom`) mal aplatis (`[object Object]` ou vide) | 🟠 Majeur | `lib/export.ts` | ✅ Corrigé |
| Aucun moyen de réinitialiser le mot de passe d'un employé (backend) | 🟠 Majeur | `api/users/[id]/route.ts` | ✅ Backend corrigé (`77400fe`) — **UI encore à faire, voir tâche ci-dessous** |

### ⚠️ Recommandation non exécutée — à faire avant de considérer le bug crédit clos
Auditer manuellement en base (Supabase Table Editor) les ventes historiques `modePaiement = 'CREDIT'` : leur `statut` est probablement à tort `COMPLETE` et le `soldeCredit` des clients concernés est sous-évalué depuis l'origine du projet. C'est une réparation de données, pas seulement de code — **personne ne l'a encore faite.**

### 🆕 Nouveaux constats du 04/07/2026 à intégrer aux phases existantes (fait ci-dessous dans ce document)
Issus d'un test utilisateur réel de Nabé sur l'app déployée — intégrés phase par phase plus bas :
- Dashboard sans aucun lien cliquable nulle part (aggrave la Phase 5, remonté en priorité)
- Stock non visible pendant la sélection de quantité au POS (Phase 2)
- Aucune vérification de cohérence du montant d'ouverture de caisse (Phase 2)
- Reçu WhatsApp : texte seul (limite technique du lien `wa.me`, pas un bug), et nom du client absent du message (Phase 2)
- Droit du caissier à voir l'historique complet de tous les caissiers : **décision produit à trancher par Nabé**, pas un bug (Phase 1)
- Suggestions de commande basées uniquement sur stock/seuil, sans tenir compte des ventes réelles (Phase 3, déjà partiellement couvert, précisé ci-dessous)
- UI de réinitialisation mot de passe personnel manquante malgré le backend maintenant prêt (Phase 1BIS)
- Import : prévoir aussi le cas d'une pharmacie sans base de données exportable du tout (Phase 1BIS)

---

## Vue d'ensemble des phases (mise à jour 04/07/2026)

| Phase | Nom | Statut |
|---|---|---|
| 0 | Fondations design (composants réutilisables) | 🟡 Composants créés, mais tests de sortie non satisfaits (voir ci-dessus) |
| 1 | Confiance & sécurité opérationnelle | ⏳ Pas commencée (13 confirm/alert restants) |
| 1BIS | Import initial de catalogue et stock | ⏳ Pas commencée |
| 2 | Vitesse du geste quotidien (Caisse + POS) | ⏳ Pas commencée |
| 2BIS | Combler les manques structurels du schéma | ⏳ Pas commencée |
| 3 | Commandes & Stock | ⏳ Pas commencée |
| 4 | Rapports comme vrai outil de pilotage | ⏳ Pas commencée (CMV déjà corrigé en urgence, voir ci-dessus) |
| 5 | Cohérence globale & guidage utilisateur | ⏳ Pas commencée |
| 6 | Confort personnel (profil, thème, logo) | ⏳ Pas commencée |
| 7 | Qualité finale & audit complet | ⏳ Pas commencée |

---

## PHASE 0 — Fondations design : système de composants réutilisables

### Objectif
Créer une bibliothèque de composants Tailwind cohérents, utilisés partout, pour que chaque nouvelle page (et chaque page existante retouchée) ait automatiquement l'apparence professionnelle sans réinventer le style à chaque fois.

### Pourquoi en premier
Actuellement, chaque page a probablement son propre style de bouton, de card, de badge, de confirmation (`window.confirm()` natif noté comme dette technique dans JOURNAL.md Session B). Sans ce socle, toute amélioration UI ultérieure sera à refaire.

### Tâches

**0.1 — Créer `DESIGN-SYSTEM.md` (local, non commité, comme CONTEXTE.md)**
- Palette étendue : navy `#0D2847` + vert `#2ECC8A` + fond `#EEF1F6`, plus les nuances nécessaires (gris texte, rouge erreur, orange alerte, vert succès — cohérents avec les badges déjà utilisés)
- Échelle de typographie (titres H1-H3, corps, petit texte) — tailles et poids fixes
- Échelle d'espacement (basée sur Tailwind par défaut, mais documenter les valeurs utilisées : `p-4`, `p-6`, `gap-4`, etc.)
- Rayons : `14px` (déjà fixé) partout, y compris boutons et inputs
- Ombres : définir 2-3 niveaux (card au repos, card au survol, modale)

**0.2 — Composants de base dans `src/components/ui/`**
- `Button.tsx` — variantes `primary` (vert), `secondary` (navy outline), `danger` (rouge), `ghost` — états `loading`, `disabled`
- `Card.tsx` — conteneur standard avec padding/radius/ombre fixes
- `Badge.tsx` — variantes `success`, `warning`, `danger`, `info`, `neutral` (remplace les classes de couleur dupliquées pour ANNULEE/PARTIELLE/COMPLETE, Stock bas, Crédit, etc.)
- `Modal.tsx` — remplace `window.confirm()` et `window.alert()` partout — support `onConfirm`/`onCancel`, variante destructive (rouge) pour archivage/annulation
- `EmptyState.tsx` — icône + message + action suggérée, pour toute liste vide (aucune vente, aucun client, aucune commande)
- `Toast.tsx` + `ToastProvider` — notifications de succès/erreur non-bloquantes, pour remplacer les messages d'erreur silencieux ou les `alert()` restants
- `Skeleton.tsx` — état de chargement cohérent (remplace les "Chargement..." textuels)
- `Input.tsx` / `Select.tsx` — champs de formulaire standardisés avec label, erreur inline, état focus cohérent
- `PageHeader.tsx` — titre de page + description + actions (bouton principal à droite), pattern répété sur presque toutes les pages

**0.3 — Migration progressive**
- Ne pas tout migrer d'un coup. Chaque phase suivante migre les composants des pages qu'elle touche vers cette bibliothèque.

### Commits
```
feat(ui): créer bibliothèque de composants Button, Card, Badge, Modal
feat(ui): ajouter EmptyState, Toast, Skeleton et ToastProvider
feat(ui): ajouter Input, Select et PageHeader standardisés
docs: créer DESIGN-SYSTEM.md avec palette, typo, espacements figés
```

### Tests de fin de phase
- [x] Chaque composant a un état visuel cohérent avec le design system (navy/vert/radius 14px) — vérifié par lecture de code, pas encore par capture d'écran réelle
- [ ] `Modal` fonctionne pour au moins un cas réel (ex : confirmation d'archivage dépense) avant de continuer — **pas fait, composant créé mais zéro usage réel, à faire en Phase 1**
- [ ] `Toast` s'affiche et se ferme automatiquement après quelques secondes — **pas fait, branché globalement mais jamais appelé pour de vrai, à faire en Phase 1**
- [x] Aucune régression sur les pages non touchées (build passe : `npm run build`) — confirmé plusieurs fois par Nabé

**⚠️ Phase 0 non close tant que les deux tests Modal/Toast ne sont pas cochés — se fermera naturellement en traitant les 13 `confirm()`/`alert()` de la Phase 1 (tâche 1.2).**

---

## PHASE 1 — Confiance & sécurité opérationnelle

### Objectif
Garantir qu'un outil qui gère de l'argent réel et du stock réel dans une pharmacie ne perd jamais de données, communique clairement qui peut faire quoi, et confirme toute action destructive.

### Pourquoi avant tout le reste
C'est le point que ni Copilot ni un plan "esthétique" ne priorise naturellement, mais c'est celui qui détermine si la pharmacienne fait confiance à l'outil sur le long terme. Une perte de données ou une action irréversible sans confirmation peut tuer l'adoption en une fois.

### Tâches

**1.1 — Fiabiliser la traçabilité du backup B2**
*Audit réel effectué le 04/07/2026 (clone du repo) : `vercel.json` contient bien les deux crons (`alertes` 7h, `backup` 2h) — la note "vercel.json manquant" de l'audit du 30/06 est donc obsolète, corrigée entretemps. La route `/api/cron/backup/route.ts` est une vraie implémentation fonctionnelle : auth Backblaze B2 réelle, upload JSON par pharmacie avec SHA1, gestion d'erreur individuelle par pharmacie. Le vrai problème restant : elle ne trace ses résultats que via `console.log`/`console.error` — invisible sans aller fouiller les logs Vercel.*
- Ajouter un enregistrement `AuditLog` (userId/pharmacieId optionnels — le schéma le permet déjà) à chaque exécution : `action: 'BACKUP_REUSSI'` ou `'BACKUP_ECHEC'`, avec le détail JSON déjà construit dans `resultats`
- Créer un petit encart dans le panneau SUPER_ADMIN affichant la date du dernier backup réussi par pharmacie et son statut
- Alerte email à l'admin (réutiliser `lib/email.ts` déjà existant) si un backup échoue 2 jours de suite pour une pharmacie

**1.2 — Remplacer toutes les confirmations natives par `Modal` (Phase 0)**
*Inventaire réel (grep sur le repo, 04/07/2026) — 5 `confirm()` natifs à remplacer :*
- `src/app/(dashboard)/medicaments/[id]/page.tsx:43` — archivage médicament
- `src/app/(dashboard)/fournisseurs/page.tsx:54` — archivage fournisseur
- `src/app/(dashboard)/clients/[id]/page.tsx:144` — archivage client
- `src/app/(dashboard)/depenses/page.tsx:78` — archivage dépense
- `src/app/(dashboard)/personnel/page.tsx:103` — activation/désactivation compte

*Et 8 `alert()` bruts à remplacer par `Toast` (erreurs) plutôt que `Modal` (ce sont des messages, pas des confirmations) :*
- `src/app/(dashboard)/inventaire/page.tsx:111,171,175` — erreurs et succès validation inventaire
- `src/app/(dashboard)/ventes/[id]/page.tsx:113,114,147` — panier vide, montant manquant, erreur serveur
- `src/app/(dashboard)/ventes/page.tsx:77,78,104` — mêmes cas côté POS
- `src/app/(dashboard)/credits/page.tsx:48` — client sans téléphone

- Archivage plutôt que suppression : rappeler visuellement dans chaque `Modal` que l'action est réversible ou non (ex : "Cette dépense sera archivée, pas supprimée — vous pourrez la consulter dans l'historique")

**1.3 — Rendre les permissions visibles, pas seulement appliquées**
- Sur les pages où une action est masquée pour CAISSIER (ex : bouton Archiver absent), ajouter un état visuel discret expliquant pourquoi si pertinent (ex : badge "Réservé aux administrateurs" au survol, pas une popup intrusive)
- Page Personnel : afficher clairement le tableau des droits par rôle (reprendre le tableau §7.2 de CONTEXTE.md, mais visible et lisible pour l'admin dans l'app elle-même, pas seulement dans un doc technique)

**1.4 — Renforcer la sécurité des routes (Session H notée "tests partiels/simulés")**
*Confirmé par lecture du code : `src/app/api/test-securite/route.ts` ne fait que comparer des `count()` filtrés vs non filtrés avec la session courante — cela prouve que le filtre `where: { pharmacieId }` existe, mais ne teste jamais un vrai appel sans token, un vrai 403 avec un rôle CAISSIER, ni un vrai 404 avec l'ID exact d'une ressource d'une autre pharmacie. C'est un test de présence de filtre, pas un test de sécurité d'accès.*
- Réécrire `test-securite` (ou créer un script séparé `scripts/test-securite.ts` exécuté manuellement) avec de vrais appels `fetch` :
  - Requête avec le token d'un compte CAISSIER vers une route Admin (ex : `/api/rapports`) → doit renvoyer 403
  - Requête sans header `Authorization`/cookie de session vers une route protégée → doit renvoyer 401
  - Requête avec un token valide de la pharmacie A vers l'ID exact d'une ressource de la pharmacie B (ex : `/api/clients/[id-pharmacie-B]`) → doit renvoyer 404, jamais 403 ni les données
- ~~Vérifier que tous les `$queryRaw` utilisent `Prisma.sql`~~ — **déjà vérifié le 04/07/2026** : seules 2 occurrences dans tout le repo (`api/ventes/route.ts`, `(dashboard)/clients/page.tsx`), toutes deux construisent leurs clauses `WHERE` via `Prisma.sql` + `Prisma.join`, aucune concaténation de chaîne brute détectée. Point conforme, aucune action requise.
- Ajouter un rate limiting basique sur `/api/auth/[...nextauth]` si absent (protection brute-force login)

**1.5 — Audit log consultable et compréhensible**
- Vérifier que `/rapports/audit` (déjà existant) affiche les actions en français lisible, pas juste `action: "DEPENSE_ARCHIVEE"` brut — mapper vers des libellés humains ("Dépense archivée par Fatou — 14/06/2026 10h32")

**1.6 — 🚦 Décision produit requise : droit du caissier sur l'historique des ventes**
*Confirmé le 04/07/2026 : `GET /api/ventes` ne filtre que par `pharmacieId`, jamais par `userId` selon le rôle. N'importe quel CAISSIER voit aujourd'hui l'historique complet de tous les caissiers de la pharmacie. Ce n'est pas un bug — CONTEXTE.md §7.2 ne tranche pas ce point — mais Nabé doit décider avant qu'on considère le sujet clos :*
- **Option A** : garder l'historique complet visible à tous (utile pour retrouver une vente/gérer un retour même fait par un collègue)
- **Option B** : restreindre un CAISSIER à ses propres ventes uniquement, Admin voit tout
- Une fois la décision prise, ajuster `GET /api/ventes` (filtre conditionnel sur `userId` si rôle CAISSIER) et le documenter dans CONTEXTE.md §7.2

### Commits
```
fix(cron): ajouter schedule backup manquant dans vercel.json
feat(backup): tracer succès/échec des backups avec alerte email
refactor(ui): remplacer window.confirm par Modal sur archivage et annulation
feat(personnel): afficher tableau des droits par rôle dans l'interface
test(securite): retester fuite multi-tenant, 401, 403 avec appels HTTP réels
fix(securite): ajouter rate limiting sur route de connexion
feat(audit): afficher libellés humains dans le journal d'activité
```

### Tests de fin de phase
- [ ] Un backup manuel déclenché → fichier visible dans B2 → trace en base confirmée
- [ ] Chaque archivage/annulation dans l'app passe par une modale stylée, plus aucun `window.confirm`
- [ ] Requête avec un ID d'une autre pharmacie → 404 confirmé sur au moins 3 routes différentes (ventes, clients, médicaments)
- [ ] Connexion avec un compte CAISSIER → tentative d'accès à `/rapports` → 403 ou redirection propre
- [ ] Journal d'audit lisible par un non-développeur (test : montrer à la pharmacienne pilote, elle doit comprendre sans explication)

---

## PHASE 1BIS — Import initial de catalogue et stock (onboarding nouvelle pharmacie)

### Contexte
Absent du plan initial, ajouté suite à une remarque de Nabé le 04/07/2026 — et confirmé par audit direct : **aucun mécanisme d'import en masse n'existe**, `POST /api/medicaments` n'accepte qu'un médicament à la fois. Pour la pharmacie pilote, saisir manuellement 20 médicaments était acceptable en phase de test. Pour une **nouvelle** pharmacie cliente qui peut avoir plusieurs centaines de références, une saisie unitaire obligatoire est un frein d'adoption majeur — potentiellement rédhibitoire dès la démo.

Cette phase passe avant la Phase 2 (vitesse du geste quotidien) parce qu'elle conditionne littéralement la capacité à onboarder qui que ce soit d'autre que la pharmacie pilote — c'est un blocage business, pas un confort.

### Objectif
Permettre à une nouvelle pharmacie d'importer en une seule fois son catalogue de médicaments **et** son stock initial (lots, quantités, dates de péremption), sans passer par le formulaire un par un.

### Constat réel (audit du 04/07/2026)
- Aucune route, aucun bouton, aucune trace de mot "import" dans tout le code
- Le formulaire `/medicaments/nouveau` (Session 4) ne traite qu'un médicament à la fois
- Même en important le catalogue seul, une pharmacie se retrouverait avec des médicaments à 0 unité en stock (aucun `Lot` créé) — il faut penser les deux imports ensemble, pas seulement le catalogue

### Tâches

**1bis.1 — Import du catalogue médicaments**
- Bouton "Importer des médicaments" sur `/medicaments`, visible Admin uniquement
- Modèle de fichier téléchargeable (`.xlsx`) avec les colonnes exactes attendues : `nom*`, `description`, `categorie`, `unite`, `prixVente*`, `prixAchat`, `stockMinimum` (`*` = obligatoire)
- Upload du fichier rempli (réutiliser `xlsx` en import dynamique, même logique que l'export de la Phase 0 — parser côté client avec `XLSX.read()`)
- **Écran de prévisualisation avant tout enregistrement** : tableau des lignes détectées, erreurs de validation surlignées ligne par ligne (nom manquant, prix invalide, etc.) — rien n'est écrit en base tant que Nabé/l'admin n'a pas cliqué "Confirmer l'import"
- Détection des doublons par nom (insensible à la casse) au sein de la même pharmacie : proposer "Ignorer" ou "Mettre à jour" ligne par ligne plutôt qu'une erreur bloquante globale
- Import réel : `prisma.$transaction` avec création en lot, `AuditLog IMPORT_MEDICAMENTS` avec le nombre de lignes importées/ignorées/en erreur

**1bis.2 — Import du stock initial (lots)**
- Bouton "Importer le stock initial" sur `/stock`, visible Admin uniquement — **accessible seulement après avoir importé ou saisi au moins un médicament**
- Modèle de fichier séparé : `nomMedicament*` (pour associer au bon médicament déjà existant), `numeroLot`, `datePeremption*`, `quantite*`, `prixAchat`
- Association par nom exact (insensible à la casse) au sein de la pharmacie : si le médicament n'est pas trouvé, la ligne est rejetée avec un message clair ("Médicament 'Paracétamol 500' introuvable — importez-le d'abord ou vérifiez l'orthographe exacte")
- Même écran de prévisualisation avant confirmation que 1bis.1

**1bis.3 — Import optionnel clients et fournisseurs (même mécanisme réutilisé)**
- Beaucoup de pharmacies tiennent déjà un cahier ou fichier de clients à crédit et de fournisseurs — proposer le même mécanisme d'import (modèle + prévisualisation) sur `/clients` et `/fournisseurs`
- Priorité plus basse que 1bis.1/1bis.2 : à faire si le temps le permet dans cette phase, sinon reporté sans bloquer le reste

**1bis.4 — 🆕 Mode saisie rapide en grille (pharmacie sans BDD exportable ou sans BDD du tout)**
*Ajouté le 04/07/2026 suite à une remarque de Nabé : toutes les pharmacies n'ont pas un fichier Excel propre à exporter — certaines tiennent un cahier papier, d'autres un logiciel dont elles ne peuvent rien extraire. Le modèle Excel seul ne couvre pas ce cas.*
- Sur le même écran d'import, proposer une **grille de saisie type tableur directement dans l'app** (plusieurs lignes vides éditables, coller depuis n'importe quelle source — même du texte copié depuis une photo retranscrite à la main) en alternative au fichier
- Cette grille alimente le même pipeline de validation/prévisualisation que l'import fichier (1bis.1/1bis.2) — un seul mécanisme de validation, deux façons d'y entrer les données
- Objectif explicite : une pharmacie qui n'a **rien** d'exportable doit quand même pouvoir aller plus vite qu'un formulaire un par un, même si elle tape tout à la main

### Tâches techniques
- Créer un composant réutilisable `ImportModal` (au-dessus de `Modal` de la Phase 0) : upload fichier → parsing → prévisualisation avec erreurs → confirmation — un seul composant générique paramétrable par les 4 cas d'usage (médicaments, stock, clients, fournisseurs) plutôt que 4 implémentations séparées
- Limiter la taille de fichier acceptée (ex: 5000 lignes max par import) pour éviter un timeout sur une transaction trop lourde compte tenu de la latence Guinée-Europe

### Commits
```
feat(import): creer composant ImportModal reutilisable (upload, previsualisation, confirmation)
feat(medicaments): ajouter import en masse depuis fichier Excel avec modele telechargeable
feat(stock): ajouter import du stock initial (lots) associe par nom de medicament
feat(clients): ajouter import en masse clients existants
feat(fournisseurs): ajouter import en masse fournisseurs existants
```

### Tests de fin de phase
- [ ] Télécharger le modèle Excel médicaments, le remplir avec 50 lignes de test, importer → les 50 médicaments apparaissent bien dans `/medicaments`, aucune saisie manuelle
- [ ] Importer un fichier avec une ligne invalide (prix manquant) → la ligne est signalée en prévisualisation, les autres lignes valides restent importables
- [ ] Importer deux fois le même fichier → les doublons sont détectés et proposés en "Ignorer"/"Mettre à jour", pas de duplication silencieuse
- [ ] Importer un fichier de stock initial référençant un médicament inexistant → rejeté avec message clair, le reste du fichier s'importe normalement
- [ ] Après import catalogue + stock : une vente test peut être faite immédiatement sur un médicament importé, sans étape manuelle intermédiaire
- [ ] Test avec une personne extérieure au projet : partir d'un tableur Excel quelconque de médicaments, reformater aux colonnes du modèle, importer avec succès en moins de 10 minutes sans aide

---

## PHASE 2 — Vitesse du geste quotidien : Caisse & POS

### Objectif
Rendre la vente et la gestion de caisse aussi rapides et évidentes que possible pour un caissier qui n'a jamais touché un ordinateur de gestion.

### Tâches

**2.1 — POS : réduire les clics et les hésitations**
- Focus automatique sur le champ de recherche médicament à l'ouverture de la page et après chaque ajout au panier
- Raccourci clavier pour valider la vente (Entrée) quand le panier est prêt
- Affichage du total en gros caractères, toujours visible (sticky) même si le panier scrolle
- Si un seul résultat de recherche correspond exactement au nom → ajout direct au panier sans clic supplémentaire

**2.2 — Caisse : résumé de journée clair (point soulevé par Copilot, légitime)**
- Ajouter un résumé visuel en fin de journée : nombre de ventes, total espèces / mobile money / crédit, séparés
- Rendre l'indicateur d'écart (déjà présent) plus visuel : vert si équilibré, orange si petit écart, rouge si écart important — avec un seuil configurable ou au moins documenté
- Historique des clôtures précédentes accessible depuis la page caisse (pas seulement la session en cours)

**2.3 — Gestion des erreurs de vente plus claire**
- Si stock insuffisant (déjà bloqué côté backend depuis Session A) : afficher directement dans le panier quelle ligne pose problème, pas juste un message d'erreur générique
- Si session caisse non ouverte : le bandeau existe déjà (Session I) — vérifier qu'il est impossible de contourner en soumettant directement l'API sans passer par l'UI (double vérification déjà backend, à confirmer)

**2.4 — Impression du reçu : vérifier compatibilité imprimante thermique**
- Si la pharmacie utilise une imprimante thermique (58mm ou 80mm), vérifier que le CSS d'impression du reçu est adapté (largeur fixe, pas de couleurs, police lisible en petite taille)
- Sinon, documenter clairement que l'impression cible A4/PDF standard

**2.5 — Numéro de facture lisible sur le reçu (dépend de la migration `Vente.numeroFacture`, Phase 2bis)**
- Remplacer l'affichage de l'ID technique (cuid) par `numeroFacture` sur le reçu imprimé, le reçu WhatsApp, et la page `/ventes/[id]`
- Générer ce numéro de façon séquentielle par pharmacie au moment de la création de la vente (transaction Prisma pour éviter toute collision entre deux ventes simultanées)

### Commits
```
feat(pos): focus automatique et raccourci clavier pour validation rapide
feat(pos): ajout direct au panier si correspondance exacte unique
feat(caisse): ajouter résumé de journée par mode de paiement
feat(caisse): rendre l'indicateur d'écart plus visuel avec seuils
feat(caisse): ajouter historique des clôtures précédentes
fix(pos): afficher la ligne exacte en cause en cas de stock insuffisant
fix(pos): vérifier css impression compatible imprimante thermique
feat(ventes): generer numeroFacture sequentiel et l'afficher sur recu/whatsapp/detail
```

### Tests de fin de phase
- [ ] Un caissier peut faire une vente complète (recherche → ajout → paiement → reçu) en moins de 10 secondes sur un cas simple
- [ ] Fermeture de caisse avec écart → couleur et message cohérents avec le seuil défini
- [ ] Tentative de vente avec stock à 0 → la ligne fautive est visuellement identifiable dans le panier
- [ ] Reçu imprimé lisible sur le matériel réel de la pharmacie pilote (test physique si possible, sinon en PDF)
- [ ] Deux ventes créées au même instant (deux caissiers différents) → deux `numeroFacture` distincts, jamais de collision

---

## PHASE 2BIS — Combler les manques structurels du schéma (audit du 04/07/2026)

### Contexte
Cette phase n'était pas dans la version initiale du plan. Elle est née d'un audit réel du schéma complet (16 tables) déclenché par une remarque juste : les rapports et le suivi commandes sont basiques non pas seulement dans leur présentation, mais parce que **la base de données elle-même ne capture pas encore certaines informations essentielles**. Sans ces colonnes, aucune UI, aussi bien conçue soit-elle, ne peut afficher une donnée qui n'existe pas.

Conformément à la règle établie du projet (§4.1 CONTEXTE.md), toutes ces migrations doivent être regroupées et appliquées en une seule session via le **Supabase SQL Editor**, jamais une par une au fil du développement — exactement comme la Session A l'a fait avec ses 8 migrations groupées.

### Objectif
Ajouter les colonnes manquantes identifiées comme bloquantes pour un usage professionnel réel, avant de construire les rapports et le suivi commandes en Phase 3/4.

### Migrations à appliquer (groupées, une session Supabase SQL Editor)

**Priorité haute — bloquent des fonctionnalités déjà attendues :**
1. `Vente.numeroFacture` — String unique, généré séquentiellement (ex: `2026-0142`). Remplace l'affichage de l'ID technique cuid sur les reçus et exports.
2. `Medicament.codeBarre` — String nullable, unique si renseigné. Permet le scan au comptoir (POS) au lieu de taper systématiquement le nom.
3. `Medicament.dci` — String nullable (Dénomination Commune Internationale — nom générique). Permettra en Phase 3 de suggérer des équivalents génériques.
4. `LigneCommande.quantiteRecue` — Int nullable. Permet de comparer quantité commandée vs réellement reçue, ligne par ligne.
5. `CommandeFournisseur.dateLivraisonPrevue` — DateTime nullable. Permet de calculer un retard réel (date de réception effective déjà disponible via `updatedAt` au passage au statut RECUE).
6. `Lot.fournisseurId` — String nullable + FK vers Fournisseur. Traçabilité en cas de rappel de lot par un fabricant.

**Priorité secondaire — utile mais non bloquant, à la discrétion de Nabé :**
7. `Pharmacie.numeroRegistreCommerce` — String nullable (documents officiels)
8. `Depense.pieceJustificative` — String nullable (URL vers un fichier justificatif, si stockage de fichiers ajouté un jour)
9. `User.telephone` — String nullable

### Tâches techniques associées
- Générer `numeroFacture` de façon séquentielle par pharmacie (pas globalement) — nécessite une logique applicative (ex: compteur en base, ou requête `MAX(numeroFacture) + 1` filtrée par `pharmacieId` dans une transaction) plutôt qu'un simple auto-increment SQL, pour respecter le multi-tenant
- Mettre à jour `prisma/schema.prisma` après chaque migration, puis `npx prisma generate`
- Décider d'un format de scan de code-barre : douchette USB (agit comme un clavier, aucune intégration technique nécessaire au-delà d'un `onKeyDown`/focus automatique du champ recherche) vs scan caméra mobile (nécessiterait une librairie type `@zxing/library`, à évaluer séparément si besoin)

### Tests de fin de phase
- [ ] Les 6 migrations prioritaires appliquées sans erreur dans Supabase SQL Editor
- [ ] `npx prisma generate` réussit avec le schéma mis à jour
- [ ] Une nouvelle vente génère bien un `numeroFacture` séquentiel unique par pharmacie, pas de collision entre deux pharmacies (test avec Centrale et Horizon en parallèle)
- [ ] Un médicament avec `codeBarre` renseigné peut être retrouvé par ce code dans l'API `/api/medicaments`

---

## PHASE 3 — Commandes & Stock : profondeur fonctionnelle avant polish

### Objectif
Faire passer le suivi des commandes de "on note ce qu'on a demandé" à "on sait vraiment ce qui a été livré, quand, et si un fournisseur est fiable" — avant de rendre l'interface plus jolie.

### Constat réel (audit du 04/07/2026)
- Aucun export (Excel/CSV/PDF) n'existe sur `/fournisseurs/commandes` — zéro, pas juste incomplet.
- `LigneCommande` n'a **aucun champ pour la quantité réellement reçue** — seulement la quantité commandée. Impossible de détecter qu'un fournisseur a livré moins que prévu.
- `CommandeFournisseur` n'a **aucune date de livraison prévue** — impossible de mesurer un retard réel, seulement de constater qu'une commande est "ENVOYEE" depuis un moment.
- Aucun rapport "commandes" n'existe dans `/rapports` (voir Phase 4).

### 🧱 3.1 — Migrations SQL
*Déjà couvertes par la Phase 2bis (`LigneCommande.quantiteRecue`, `CommandeFournisseur.dateLivraisonPrevue`, `Medicament.codeBarre`, `Medicament.dci`) — appliquées en amont, groupées avec les autres migrations structurelles. Rien à re-migrer ici : cette section ne fait que rappeler les colonnes dont dépend cette phase.*
- `quantiteRecue` nullable : `null` tant que la commande n'est pas reçue, renseignée à la réception (peut différer de `quantite` commandée)
- `dateLivraisonPrevue` nullable : renseignée à l'envoi de la commande (ex: `createdAt` + délai habituel du fournisseur, ou saisie manuelle)
- `codeBarre` / `dci` : utilisées respectivement en 3.4bis (scan POS) et 3.4ter (suggestion générique) ci-dessous

### 🧱 3.2 — Suivi réel des écarts et retards
- À la réception d'une commande (`api/commandes/[id]/route.ts`, déjà existant) : ajouter un champ de saisie `quantiteRecue` par ligne, différent de `quantite` commandée si écart
- Si `quantiteRecue < quantite` pour une ligne → `AuditLog COMMANDE_ECART_LIVRAISON` avec le détail, et bannière visible sur la commande ("Écart de livraison : 2 lignes incomplètes")
- Calcul du retard : `dateLivraisonPrevue` vs date de réception réelle — badge "En retard de X jours" si applicable
- Page fournisseur (`/fournisseurs`) : ajouter un indicateur "Fiabilité" par fournisseur (% de commandes livrées à temps sur les 90 derniers jours) — première vraie donnée de pilotage fournisseur de l'app

### 🧱 3.3 — Export commandes (n'existe pas du tout aujourd'hui)
- Bouton "Exporter" sur `/fournisseurs/commandes` (Excel/CSV/PDF, réutiliser `lib/export.ts` de la Phase 0)
- Colonnes : fournisseur, date commande, date livraison prévue, date réception réelle, statut, montant total, écart de livraison (oui/non)
- Export "historique par fournisseur" : filtrable par fournisseur, période, statut

### 🎨 3.4 — Recherche médicament dans les commandes (polish, déjà prévu)
- Remplacer le `<select>` par un champ de recherche avec autocomplétion (filtrage en temps réel par nom, affichage stock actuel + prix d'achat habituel pendant la frappe)
- Pré-remplissage intelligent déjà en place (Session I) — s'assurer qu'il reste après le changement de composant

### 🎨 3.5 — Commandes suggérées : rendre le workflow visible (polish, déjà prévu)
- Le bouton "Commandes suggérées" existe (Session E) — vérifier qu'il explique pourquoi chaque médicament est suggéré (ex : "Stock 8 / seuil 60 — suggéré : 100 unités") plutôt qu'une liste brute

### 🧱 3.4bis — Scan code-barre au comptoir (dépend de `Medicament.codeBarre`, Phase 2bis)
- POS : le champ de recherche accepte un scan de douchette USB (se comporte comme une saisie clavier très rapide suivie d'Entrée) — recherche automatique par `codeBarre` exact en priorité sur la recherche par nom
- Interface médicament (`/medicaments/[id]` et formulaire de création) : champ pour renseigner/modifier le code-barre, avec validation d'unicité côté API

### 🧱 3.4ter — Suggestion d'équivalents génériques (dépend de `Medicament.dci`, Phase 2bis)
- Sur la fiche médicament et dans le POS en cas de rupture de stock détectée : si un autre médicament actif de la même pharmacie partage la même `dci`, le proposer comme équivalent possible ("Rupture de Paracétamol 500 — Doliprane 500 disponible, même DCI")

### 🧱 3.6 — Stock : valorisation, pas seulement alertes
- Ajouter un calcul de valorisation totale du stock (`Σ Lot.prixAchat × Lot.quantite`) — donnée de gestion de base actuellement absente de `/stock`
- Identifier les "produits dormants" : médicaments actifs sans aucune vente depuis 60/90 jours (utile pour ne pas réapprovisionner ce qui ne se vend pas)

### 🎨 3.7 — Stock : lisibilité des alertes (polish, déjà prévu)
- Regrouper visuellement "Ruptures", "Stock bas", "Péremption proche" en sections distinctes plutôt qu'une liste unique à filtrer mentalement
- Ajouter un compteur global en haut de page ("3 ruptures, 5 stocks bas, 2 péremptions proches")

### 🎨 3.8 — Mouvements de stock : contexte plus riche (polish, déjà prévu)
- Vérifier que chaque mouvement affiche clairement l'origine (vente, réception commande, ajustement inventaire, retour) avec un lien vers l'objet source

### Commits
```
migration(commandes): ajouter quantiteRecue et dateLivraisonPrevue
feat(commandes): saisir quantite recue a la reception, detecter les ecarts
feat(commandes): calculer et afficher le retard de livraison
feat(fournisseurs): ajouter indicateur de fiabilite par fournisseur
feat(commandes): ajouter export Excel/CSV/PDF avec historique par fournisseur
feat(commandes): remplacer select par recherche autocompletee medicament
feat(commandes): expliquer la raison de chaque suggestion (stock/seuil)
feat(pos): ajouter recherche par code-barre scanne en priorite sur le nom
feat(medicaments): ajouter champ code-barre avec validation unicite
feat(medicaments): suggerer equivalents generiques via dci en cas de rupture
feat(stock): ajouter valorisation totale et detection produits dormants
feat(stock): regrouper alertes par categorie avec compteur global
feat(stock): lier chaque mouvement a son objet source
```

### Tests de fin de phase
- [ ] Réceptionner une commande avec une quantité inférieure à la commandée → écart détecté, badge visible, AuditLog créé
- [ ] Une commande reçue après sa `dateLivraisonPrevue` → badge "En retard" correct
- [ ] Page fournisseurs → indicateur de fiabilité cohérent avec l'historique réel
- [ ] Export Excel/CSV/PDF des commandes → fichier téléchargé, colonnes correctes, aucun `[object Object]` (vérifier avec la fonction d'aplatissement de la Phase 0)
- [ ] `/stock` → valorisation totale correspond bien à `Σ prixAchat × quantite` (vérifiable manuellement sur un petit échantillon)
- [ ] Créer une commande de 5 lignes en tapant seulement les noms, sans scroller dans une liste déroulante
- [ ] Scanner (ou simuler par saisie rapide + Entrée) un code-barre au POS → le médicament correspondant est trouvé et ajouté directement au panier
- [ ] Un médicament en rupture avec un équivalent partageant la même DCI → suggestion visible et cliquable

---

## PHASE 4 — Rapports : profondeur de contenu avant mise en forme

### Objectif
Faire passer les rapports de "4 listes basiques exportables" à un vrai outil de pilotage — le manque est dans le **contenu calculé**, pas dans la présentation.

### Constat réel (audit du 04/07/2026)
Seuls 4 types de rapports existent (`ventes`, `stock`, `benefice`, `credits`), tous relativement basiques (listes brutes avec un total). **Aucun rapport "commandes" n'existe.** Aucun rapport n'inclut de comparaison dans le temps, de classement, ou de calcul de tendance.

### 🧱 4.1 — Nouveau rapport Commandes (n'existe pas aujourd'hui)
- Montant total commandé vs reçu sur la période
- Répartition par fournisseur
- Taux de commandes en retard (une fois la Phase 3 livrée avec `dateLivraisonPrevue`)
- Nombre et valeur des écarts de livraison détectés (une fois `quantiteRecue` en place)

### 🧱 4.2 — Rapport Ventes : aller au-delà de la liste brute
- **Top médicaments vendus** sur la période (quantité et chiffre d'affaires généré par médicament)
- **Ticket moyen** (montantTotal moyen par vente)
- **Comparaison vs période précédente** (même durée, juste avant) — flèche verte/rouge + %
- Colonne `numeroFacture` (Phase 2bis) dans l'export au lieu de l'id technique cuid — actuellement le rapport ventes exporte l'id brut, peu lisible pour un usage comptable réel

### 🧱 4.3 — Rapport Stock : aller au-delà des alertes
- **Valorisation totale du stock** (`Σ Lot.prixAchat × Lot.quantite`) — déjà prévu en Phase 3.6, réutilisé ici en vue rapport
- **Rotation de stock** : à quelle vitesse un médicament type se vend en moyenne (approximation simple acceptable : ventes des 30 derniers jours / stock moyen)
- **Produits dormants** : médicaments actifs sans vente depuis 60/90 jours

### 🧱 4.4 — Rapport Crédits : ancienneté, pas seulement le solde
- **Ancienneté des créances** : depuis combien de jours chaque client a un solde > 0 (aging simple : 0-30j / 31-60j / 60j+)
- Total dû par tranche d'ancienneté — aide à prioriser les relances (les crédits très anciens sont les plus risqués)

### 🎨 4.5 — Résumé avant détail (polish, déjà prévu)
- En haut de la page : 3-4 KPIs clés du mois en cours (CA, bénéfice net, dépenses totales, panier moyen) en gros, avant tout tableau
- Comparaison avec le mois précédent (flèche verte/rouge + pourcentage) si les données existent

### 🎨 4.6 — Visualisations simples (polish, déjà prévu)
- Un graphique d'évolution du bénéfice net sur les 30 derniers jours (Recharts déjà utilisé pour le dashboard)
- Répartition des dépenses par catégorie en camembert ou barres

### 🎨 4.7 — Rapport bénéfice : rendre la formule pédagogique (polish, déjà prévu)
- La formule CA − CMV − Dépenses est déjà affichée — s'assurer qu'elle est expliquée en une phrase simple ("Ce que vous gardez après avoir payé vos achats et vos charges")

### 🎨 4.8 — Export : garder mais ne plus mettre en avant en premier (polish, déjà prévu)
- Export Excel/CSV/PDF restent accessibles mais en action secondaire, pas le point d'entrée principal de la page
- **Rappel technique** : utiliser la fonction d'aplatissement d'objets imbriqués ajoutée en Phase 0 (`lib/export.ts`) pour tout nouveau rapport — sinon tout champ de relation (ex: nom de caissier, nom de fournisseur) ressortira vide en Excel ou `[object Object]` en CSV, comme constaté le 04/07/2026

### Commits
```
feat(rapports): créer nouveau rapport commandes (montant, retard, écarts)
feat(rapports): ajouter top médicaments vendus et ticket moyen
feat(rapports): ajouter comparaison ventes vs période précédente
feat(rapports): ajouter valorisation stock et détection produits dormants
feat(rapports): ajouter rotation de stock approximative
feat(rapports): ajouter ancienneté des créances par tranche
feat(rapports): ajouter résumé KPIs en tête de page avec comparaison mois précédent
feat(rapports): ajouter graphique évolution bénéfice net 30 jours
feat(rapports): ajouter répartition dépenses par catégorie en graphique
feat(rapports): reformuler la formule bénéfice net en langage simple
refactor(rapports): repositionner les exports en actions secondaires
```

### Tests de fin de phase
- [ ] Rapport commandes → montants et taux de retard cohérents avec les vraies commandes de test
- [ ] Top médicaments vendus → correspond bien aux médicaments les plus vendus sur la période (vérifiable manuellement)
- [ ] Ancienneté des créances → un client avec un crédit vieux de 45 jours apparaît bien dans la tranche 31-60j
- [ ] Ouvrir /rapports → comprendre en moins de 10 secondes si le mois est bon ou mauvais, sans lire un seul tableau
- [ ] Export de chaque nouveau rapport → aucun champ vide ou `[object Object]` sur les colonnes de relation (caissier, fournisseur, client)

---

## PHASE 5 — Cohérence globale & guidage utilisateur

### Objectif
Faire disparaître la sensation de "patchwork" entre les pages — chaque écran doit donner l'impression de faire partie du même produit.

### Tâches

**5.1 — Appliquer `PageHeader`, `Card`, `Badge`, `EmptyState` (Phase 0) sur toutes les pages restantes**
- Passage systématique page par page : médicaments, fournisseurs, inventaire, personnel, paramètres
- Chaque liste vide utilise `EmptyState` avec une action claire ("Aucun client pour l'instant — Ajouter le premier client")

**5.2 — États de chargement cohérents**
- Remplacer tout texte "Chargement..." par `Skeleton` (Phase 0)

**5.3 — Aide contextuelle minimale**
- Sur les écrans les plus complexes (inventaire avec écarts, commandes, rapports), ajouter une icône "?" avec une courte explication au survol/clic — pas une documentation complète, juste 1-2 phrases par écran
- Une page `/aide` très simple listant les questions fréquentes ("Comment annuler une vente ?", "Comment archiver un médicament ?") avec captures ou texte court

**5.4 — Navigation : cohérence des retours**
- Vérifier que chaque page de détail (`/clients/[id]`, `/ventes/[id]`, `/medicaments/[id]`) a un bouton retour cohérent vers sa liste parente
- Fil d'Ariane simple en haut des pages profondes si pertinent (ex : Rapports > Audit)

### Commits
```
refactor(ui): appliquer composants standardisés sur medicaments, fournisseurs, inventaire
refactor(ui): appliquer composants standardisés sur personnel, parametres
feat(ui): ajouter EmptyState sur toutes les listes vides
feat(aide): ajouter tooltips contextuels sur écrans complexes
feat(aide): créer page /aide avec questions fréquentes
fix(navigation): uniformiser boutons retour et fil d'ariane
```

### Tests de fin de phase
- [ ] Naviguer 5 pages différentes d'affilée sans sensation de rupture visuelle
- [ ] Vider une liste (ex : filtrer sur une catégorie sans résultat) → EmptyState clair, pas un tableau vide silencieux
- [ ] Un nouvel utilisateur (test avec une personne qui ne connaît pas l'app) trouve la page /aide et comprend au moins 2 fonctionnalités grâce à elle

---

## PHASE 6 — Confort personnel : profil, thème, identité pharmacie

### Objectif
Ajouter les éléments de confort identifiés (par Copilot et par toi) — légitimes, mais qui n'auraient pas dû bloquer les phases précédentes.

### Tâches

**6.1 — Profil utilisateur (manquant, confirmé par l'audit Copilot)**
- Page `/profil` : modifier son propre nom, changer son mot de passe (avec vérification de l'ancien), voir son rôle (lecture seule)
- `PATCH /api/users/me` distinct de `/api/users/[id]` (qui est réservé Admin pour gérer les autres)

**6.2 — Thème clair/sombre**
- Basé sur préférence système par défaut + toggle manuel dans le profil ou la sidebar
- Utiliser les variables CSS déjà nécessaires pour le design system (Phase 0) — définir une palette sombre cohérente (navy plus clair sur fond sombre, vert accent conservé pour la reconnaissance de marque)
- Stocker la préférence en `localStorage` côté client (pas de donnée sensible)

**6.3 — Paramètres pharmacie enrichis**
- Upload de logo (stocké sur Supabase Storage ou Vercel Blob) — affiché sur les reçus, dans la sidebar, sur les exports PDF
- Séparer clairement "Informations pharmacie" (nom, adresse, logo) de "Préférences" (devise affichée si multi-devise envisagée un jour, format de date)
- Toujours garder "Compte utilisateur" (profil, mot de passe) séparé de "Pharmacie" (déjà noté comme gap par Copilot — légitime)

### Commits
```
feat(profil): créer page profil utilisateur avec modification nom et mot de passe
feat(theme): ajouter thème sombre avec toggle et détection préférence système
feat(parametres): ajouter upload logo pharmacie
feat(parametres): séparer informations pharmacie et préférences dans l'interface
feat(recus): afficher logo pharmacie sur reçu et export PDF
```

### Tests de fin de phase
- [ ] Changer son mot de passe depuis /profil → déconnexion/reconnexion avec le nouveau mot de passe fonctionne
- [ ] Basculer en thème sombre → toutes les pages restent lisibles (contraste vérifié, pas seulement le dashboard)
- [ ] Upload logo → apparaît sur un reçu imprimé et sur un export PDF de rapport

---

## PHASE 7 — Qualité finale & audit complet

### Objectif
Valider que l'ensemble tient la route avant de considérer le projet comme "V2 professionnelle" livrable en toute confiance à la pharmacie pilote et à de futures pharmacies clientes.

### Tâches

**7.1 — Audit de performance**
- Vérifier les temps de réponse réels sur les pages les plus lourdes (dashboard, rapports, historique ventes) depuis Conakry
- Confirmer qu'aucune régression N+1 n'a été introduite pendant les phases 0-6

**7.2 — Audit d'accessibilité de base**
- Contraste texte/fond suffisant en thème clair ET sombre (surtout après Phase 6)
- Taille des zones cliquables suffisante si utilisation sur tablette (les pharmacies utilisent parfois des tablettes au comptoir)

**7.3 — Test utilisateur réel avec la pharmacienne pilote**
- Scénario complet : connexion → vente → clôture caisse → consultation rapport, sans aide, chronométré et noté (bloquages observés)
- Recueillir le ressenti qualitatif ("ça a l'air pro" ou "ça a l'air d'un projet étudiant")

**7.4 — Vérification de la documentation interne**
- `CONTEXTE.md` mis à jour avec l'état final post-consolidation
- `JOURNAL.md` complété pour chaque phase réellement exécutée (garder la discipline établie)

**7.5 — Checklist de sécurité finale (reprise et étendue de Session H)**
- [ ] Multi-tenant étanche sur toutes les routes API (pas seulement celles testées en Session H)
- [ ] RLS Supabase toujours actif et cohérent avec les routes API
- [ ] Aucune clé secrète commitée (`git log -p | grep -i "key\|secret\|password"` sur tout l'historique par précaution)
- [ ] `.env`/`.env.local` toujours absents du repo

### Commits
```
perf(audit): vérifier absence de régression N+1 après consolidation UI
docs: mettre à jour CONTEXTE.md avec état final post-consolidation
docs: compléter JOURNAL.md pour phases 0 à 7
chore(securite): audit final multi-tenant et vérification secrets non commités
```

### Tests de fin de phase (checklist finale globale)
- [ ] Scénario complet pharmacienne pilote réalisé sans blocage majeur
- [ ] Aucune régression sur les fonctionnalités validées dans les sessions précédentes (reprendre la checklist Session I comme base de non-régression)
- [ ] Build de production propre (`npm run build` sans warning bloquant)
- [ ] Application testée sur mobile/tablette pour les écrans les plus utilisés (POS, caisse)

---

## Écart mineur noté dans ta documentation (à corriger toi-même, pas un bug)

`CONTEXTE.md` §4.2 laisse penser que `$queryRaw` est utilisé largement (dashboard, rapports, historique). En réalité (vérifié sur le repo) : seules 2 routes en ont besoin (`api/ventes/route.ts` pour l'historique paginé filtrable, `clients/page.tsx` pour des stats avec `WITH`). Le dashboard et les rapports utilisent `prisma.aggregate()` + `Promise.all()` — ce qui respecte tout aussi bien la contrainte de latence Guinée→Europe (pas de boucle, requêtes parallèles). Ce n'est pas un problème de code, juste une formulation de `CONTEXTE.md` à assouplir si tu veux qu'il reflète exactement la réalité ("`$queryRaw` pour les cas complexes, `aggregate`/`Promise.all` sinon" plutôt que "toutes les listes avec agrégats").

---

## Ce que ce plan ajoute au-delà de l'analyse de Copilot

Pour rester honnête sur ce qui vient d'où :
- **Repris de Copilot** : profil utilisateur, thème sombre, paramètres pharmacie enrichis, recherche médicament dans commandes, rapports comme vue de gestion, cohérence visuelle globale
- **Ajouté par ce plan** : vérification réelle du backup B2 (dette identifiée dans ton propre JOURNAL.md, Session G), sécurité renforcée avec vrais tests HTTP (dette Session H), système de composants réutilisables comme fondation plutôt que retouches page par page, notifications toast, gestion d'erreurs réseau, logo sur reçus/PDF, aide contextuelle, audit de performance et d'accessibilité final, test utilisateur réel chronométré avec la pharmacienne pilote

---

## Note sur l'ordre

Rien n'empêche de réordonner selon ce qui te semble le plus urgent une fois que tu commences — mais l'idée forte à garder : **Phase 0 avant tout le reste**, sinon chaque phase suivante recrée sa propre incohérence visuelle qu'il faudra retoucher deux fois.




# Tâche à part — Réactivation des éléments archivés (constat du 10/07/2026)

Aucune fonctionnalité de réactivation n'existe pour Medicament, Client, Fournisseur — les API list (/api/medicaments, /api/clients, /api/fournisseurs) filtrent en dur sur actif: true, sans vue "archivés" ni bouton retour arrière. À traiter : (1) une vue/filtre "voir les archivés" sur chaque liste concernée, (2) un bouton "Réactiver" avec logique inverse de l'archivage existant, (3) vérifier les conflits possibles au moment de la réactivation (ex: réactiver un médicament dont le nom a depuis été repris par un autre — pertinent vu qu'on vient de renforcer la détection de doublons à l'import).

# Tâche à part — Numéro client/fournisseur séquentiel (constat du 11/07/2026)
Ajouter Client.numeroClient et Fournisseur.numeroFournisseur (séquentiel par pharmacie, même logique que Vente.numeroFacture déjà prévu Phase 2bis). Objectif : désambiguïser les homonymes au quotidien (recherche, POS, crédits), pas seulement à l'import. Affichage dans les listes/recherches. Migration Supabase SQL Editor + génération séquentielle en transaction.

# Tâche à part — Édition en ligne dans la prévisualisation d'import (proposé le 12/07/2026)
Permettre de corriger une cellule directement dans le tableau de prévisualisation (nom, prix, etc.) sans repasser par le fichier source ou la grille manuelle — utile pour corriger un grand nombre de lignes en erreur d'un coup lors d'un import volumineux (ex: onboarding d'une pharmacie avec un catalogue existant mal formaté).

# Tâche à part — Tableau de bord de surveillance des caissiers (proposé le 19/07/2026)
Constat actuel : `/caisse` affiche un historique des 5 dernières sessions de caisse toutes pharmacies confondues (tous caissiers mélangés), avec la durée de chaque session et un repère visuel si elle dépasse la durée max fixée par l'admin (`Pharmacie.dureeMaxSessionCaisseH`, ajouté Phase 2). C'est suffisant pour un coup d'œil rapide, mais insuffisant pour un admin qui veut vraiment suivre l'activité de chaque caissier dans le temps (ex: qui ouvre des sessions anormalement longues, qui dépasse la limite régulièrement, comparer les caissiers entre eux sur une période).

À construire, réservé aux rôles ADMIN/SUPER_ADMIN :
- Une vue dédiée (nouvelle page, ex: `/caisse/historique` ou section dans `/personnel`) listant l'historique complet des sessions, pas seulement les 5 dernières
- Filtrable par caissier et par période
- Indicateurs par caissier : nombre de sessions, durée moyenne, nombre de dépassements de la durée max, écarts de caisse moyens/cumulés
- Réutilise `formaterDuree` et la logique de dépassement déjà écrites dans `caisse/page.tsx` (Phase 2) plutôt que de les dupliquer — à extraire dans un utilitaire partagé si cette page est construite

À rattacher à la Phase 3 (Commandes & Stock) ou à la Phase 5 (Cohérence & guidage), selon ce qui est priorisé au moment de s'y attaquer — pas urgent, mais à ne pas perdre de vue.