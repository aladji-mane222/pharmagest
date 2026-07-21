// CIBLE: src/lib/export.ts

// 'xlsx' n'est plus importée statiquement : elle est chargée dynamiquement
// dans exporterExcel() uniquement, pour ne pas gonfler le JS des pages qui
// n'utilisent que exporterCSV (qui n'en a jamais eu besoin) — corrigé le
// 04/07/2026, cf. `/rapports` qui chargeait 671 kB au premier affichage.

/**
 * Convertit une valeur pour l'export tableur/CSV. Les API de PharmaGest
 * renvoient souvent des relations Prisma sous forme d'objet imbriqué
 * (ex: `user: { nom: 'Fatou Camara' }` via `include: { user: { select: { nom: true } } }`).
 * Sans aplatissement : Excel affiche une cellule vide, et le CSV affiche
 * littéralement "[object Object]" (bug constaté le 04/07/2026 sur
 * rapport-ventes, colonne "user"). Corrigé ici, à la source, pour que
 * tout futur rapport avec le même genre de champ ne reproduise pas le bug.
 */
function aplatirValeur(valeur: unknown): string | number {
  if (valeur === null || valeur === undefined) return ''
  if (typeof valeur === 'object' && !(valeur instanceof Date)) {
    const objet = valeur as Record<string, unknown>
    if ('nom' in objet) return String(objet.nom)
    // Repli : rester visible/débogable plutôt qu'un silencieux "[object Object]"
    return JSON.stringify(objet)
  }
  return valeur as string | number
}

function aplatirDonnees(donnees: Record<string, unknown>[]): Record<string, unknown>[] {
  return donnees.map((ligne) => {
    const ligneAplatie: Record<string, unknown> = {}
    for (const [cle, valeur] of Object.entries(ligne)) {
      ligneAplatie[cle] = aplatirValeur(valeur)
    }
    return ligneAplatie
  })
}

export async function exporterExcel(donnees: Record<string, unknown>[], nomFichier: string) {
  const XLSX = await import('xlsx')
  const worksheet = XLSX.utils.json_to_sheet(aplatirDonnees(donnees))
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Rapport')
  XLSX.writeFile(workbook, `${nomFichier}.xlsx`)
}

export function exporterCSV(donneesBrutes: Record<string, unknown>[], nomFichier: string) {
  if (donneesBrutes.length === 0) return
  const donnees = aplatirDonnees(donneesBrutes)

  const entetes = Object.keys(donnees[0])
  const lignes = donnees.map((d) => entetes.map((e) => d[e]).join(','))
  const contenu = [entetes.join(','), ...lignes].join('\n')

  // BOM UTF-8 (\uFEFF) en tete de fichier : sans lui, Excel sur Windows
  // suppose un encodage local (souvent Windows-1252) et affiche les
  // caracteres accentues corrompus ("RÃ©ception" au lieu de "Réception")
  // — constate le 20/07/2026 sur l'export commandes, mais touchait en
  // realite tous les exports CSV de l'app puisque le bug etait ici,
  // dans la fonction partagee.
  const blob = new Blob(['\uFEFF' + contenu], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const lien = document.createElement('a')
  lien.href = url
  lien.download = `${nomFichier}.csv`
  lien.click()
  URL.revokeObjectURL(url)
}