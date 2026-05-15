# Rapport d'Audit et d'Optimisation - PharmaGest v2.4

Ce rapport détaille les causes de la latence initiale de l'application, les correctifs apportés et les directives pour le développement futur.

## 1. Le Diagnostic : Pourquoi l'application était lente ?

La lenteur (jusqu'à 18s par requête) n'était pas due à la puissance du serveur, mais à la **distance physique** entre la Guinée et les serveurs de base de données (Europe), combinée à des pratiques de code inadaptées au Cloud.

### Les 3 causes principales :
1.  **L'explosion des Allers-Retours (Round Trips)** : Chaque requête Prisma génère un "voyage" réseau. Si une page fait 6 requêtes pour afficher un tableau de bord, cela crée 6 voyages. Sur une connexion lente (300ms de latence), on perd déjà 2 secondes rien qu'en transport de données.
2.  **Le problème N+1** : C'est quand le code boucle sur une liste pour chercher des détails (ex: chercher le stock pour chaque médicament un par un). Cela peut générer des dizaines de micro-requêtes, rendant la page inutilisable.
3.  **La Compilation en mode "Dev"** : Sur Windows, Next.js prend du temps (20-40s) pour préparer les fichiers en mode développement. Ce délai est local et ne concerne pas les utilisateurs finaux.

## 2. Les Actions Correctives Effectuées

Nous avons réécrit le "moteur" de l'application pour qu'il soit ultra-efficace :

*   **Mega-Queries SQL (CTE)** : Au lieu de demander 6 informations séparément, nous utilisons maintenant une seule requête SQL complexe qui ramène **tout d'un coup**. On passe de 6 voyages réseau à 1 seul.
*   **Server-Side Rendering (SSR)** : Le Dashboard a été transformé en "Server Component". Les données sont récupérées directement par le serveur (qui est proche de la DB) avant d'envoyer la page finie à l'utilisateur.
*   **Tuning PGBouncer** : Configuration de la chaîne de connexion avec `&statement_cache_size=0` pour stabiliser la communication avec Supabase et éviter les erreurs de pooler.
*   **Indexation Performance** : Ajout d'index SQL sur toutes les colonnes de filtrage (`pharmacieId`, `actif`, `createdAt`) pour que la base de données réponde en quelques millisecondes.

## 3. Guide de survie pour l'équipe (À faire / À éviter)

Pour que votre ami et vous gardiez l'application rapide, suivez ces règles :

### ✅ À FAIRE (Best Practices)
*   **Utiliser `prisma.$queryRaw` pour les listes** : Si vous devez afficher un tableau avec des totaux ou des jointures, le SQL brut est 10 fois plus rapide que Prisma classique sur une connexion à haute latence.
*   **Privilégier les Server Components** : Chargez les données initiales dans le fichier `page.tsx` (côté serveur) plutôt que dans un `useEffect` (côté client).
*   **Faire des transactions** : Pour les ventes ou les stocks, utilisez toujours `prisma.$transaction` pour garantir que tout est enregistré correctement sans erreurs.

### ❌ À ÉVITER (Anti-patterns)
*   **Éviter les boucles de requêtes** : Ne faites jamais un `await prisma.table.find(...)` à l'intérieur d'un `.map()` ou d'un `for`.
*   **Éviter les `include` profonds** : Les `include: { a: { include: { b: ... } } }` créent des requêtes en cascade très lentes. Préférez un `JOIN` en SQL brut.
*   **Ne pas multiplier les petits `fetch()`** : Essayez de regrouper vos appels API. Un gros appel est toujours préférable à 5 petits.

## 4. Recommandations pour le Lancement (Production)

Avant d'ouvrir l'application aux pharmacies, voici les étapes cruciales :

1.  **Déploiement Proche** : Déployez l'application sur Vercel dans une région proche de votre base de données Supabase (ex: `eu-west` pour l'Irlande).
2.  **Prisma Accelerate** : Activez ce service (Connection Pooler global). Il réduit la latence de connexion de manière drastique pour les utilisateurs internationaux.
3.  **Mise en cache** : Utilisez le `Cache-Control` sur les API qui ne changent pas souvent (ex: liste des catégories) pour économiser des appels DB.
4.  **Optimisation des images** : Utilisez le composant `<Image />` de Next.js pour ne pas saturer la connexion internet guinéenne avec des images trop lourdes.

---
*Rapport établi le 15/05/2026 pour l'équipe PharmaGest.*
