
// 'xlsx' n'est plus importee statiquement : elle est chargee dynamiquement
// dans exporterExcel() uniquement, pour ne pas gonfler le JS des pages qui
// n'utilisent que exporterCSV (qui n'en a jamais eu besoin) — corrige le
// 04/07/2026, cf. `/rapports` qui chargeait 671 kB au premier affichage.

export interface SectionExport {
  nom: string // nom de la section / feuille (ex: "Commandes", "Par fournisseur")
  donnees: Record<string, unknown>[]
}

/**
 * Convertit une valeur pour l'export tableur/CSV. Les API de PharmaGest
 * renvoient souvent des relations Prisma sous forme d'objet imbriqué
 * (ex: `user: { nom: 'Fatou Camara' }` via `include: { user: { select: { nom: true } } }`).
 * Sans aplatissement : Excel affiche une cellule vide, et le CSV affiche
 * litteralement "[object Object]" (bug constate le 04/07/2026 sur
 * rapport-ventes, colonne "user"). Corrige ici, a la source, pour que
 * tout futur rapport avec le meme genre de champ ne reproduise pas le bug.
 */
function aplatirValeur(valeur: unknown): string | number {
  if (valeur === null || valeur === undefined) return ''
  if (typeof valeur === 'object' && !(valeur instanceof Date)) {
    const objet = valeur as Record<string, unknown>
    if ('nom' in objet) return String(objet.nom)
    // Repli : rester visible/debogable plutot qu'un silencieux "[object Object]"
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

// RFC 4180 : un champ contenant une virgule, un guillemet ou un retour a
// la ligne doit etre entoure de guillemets, et tout guillemet interne
// double. Corrige le 23/07/2026 — documente comme deja fait lors de
// l'audit de cloture Phase 3 mais absent du code reellement present ici ;
// l'ecart n'a pas ete explique, corrige a nouveau pour de bon.
function champCSV(valeur: unknown): string {
  const s = String(valeur ?? '')
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return '"' + s.replace(/"/g, '""') + '"'
  }
  return s
}

function sectionVersLignesCSV(section: SectionExport): string[] {
  if (section.donnees.length === 0) return []
  const donnees = aplatirDonnees(section.donnees)
  const entetes = Object.keys(donnees[0])
  const lignes = donnees.map((d) => entetes.map((e) => champCSV(d[e])).join(','))
  return [entetes.map(champCSV).join(','), ...lignes]
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
  const contenu = sectionVersLignesCSV({ nom: 'Rapport', donnees: donneesBrutes }).join('\n')
  telechargerCSV(contenu, nomFichier)
}

/**
 * Export multi-sections (Phase 4, 23/07/2026) — permet a un rapport de
 * proposer plusieurs tableaux (ex: "Commandes" + "Par fournisseur") et de
 * choisir lesquels exporter, plutot que de toujours tout exporter en vrac
 * ou de ne jamais exporter que le premier tableau (bug remonte par Nabe :
 * l'export commandes n'incluait jamais la repartition par fournisseur).
 *
 * Excel : une feuille par section. CSV : sections concatenees, separees
 * par une ligne de titre (## Nom de la section) et une ligne vide — un
 * seul fichier reste plus simple a manipuler qu'un zip de plusieurs CSV.
 */
export async function exporterExcelMultiSections(sections: SectionExport[], nomFichier: string) {
  const XLSX = await import('xlsx')
  const workbook = XLSX.utils.book_new()
  for (const section of sections) {
    if (section.donnees.length === 0) continue
    const worksheet = XLSX.utils.json_to_sheet(aplatirDonnees(section.donnees))
    // Nom de feuille Excel limite a 31 caracteres, pas de : \ / ? * [ ]
    const nomFeuille = section.nom.replace(/[:\\/?*[\]]/g, '').slice(0, 31) || 'Feuille'
    XLSX.utils.book_append_sheet(workbook, worksheet, nomFeuille)
  }
  if (workbook.SheetNames.length === 0) return
  XLSX.writeFile(workbook, `${nomFichier}.xlsx`)
}

export function exporterCSVMultiSections(sections: SectionExport[], nomFichier: string) {
  const blocs: string[] = []
  for (const section of sections) {
    const lignes = sectionVersLignesCSV(section)
    if (lignes.length === 0) continue
    blocs.push(`## ${section.nom}`, ...lignes, '')
  }
  if (blocs.length === 0) return
  telechargerCSV(blocs.join('\n'), nomFichier)
}

function telechargerCSV(contenu: string, nomFichier: string) {
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
