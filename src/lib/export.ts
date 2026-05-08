import * as XLSX from 'xlsx'

export function exporterExcel(donnees: Record<string, unknown>[], nomFichier: string) {
  const worksheet = XLSX.utils.json_to_sheet(donnees)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Rapport')
  XLSX.writeFile(workbook, `${nomFichier}.xlsx`)
}

export function exporterCSV(donnees: Record<string, unknown>[], nomFichier: string) {
  if (donnees.length === 0) return

  const entetes = Object.keys(donnees[0])
  const lignes = donnees.map((d) => entetes.map((e) => d[e]).join(','))
  const contenu = [entetes.join(','), ...lignes].join('\n')

  const blob = new Blob([contenu], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const lien = document.createElement('a')
  lien.href = url
  lien.download = `${nomFichier}.csv`
  lien.click()
  URL.revokeObjectURL(url)
}
