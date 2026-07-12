'use client'

import { useCallback, useState } from 'react'
import Button from './Button'
import { useToast } from './Toast'

export interface ImportField {
  /** Clé technique envoyée au backend (doit correspondre au champ attendu par l'API) */
  key: string
  /** Libellé affiché à l'écran de correspondance */
  label: string
  required?: boolean
  /**
   * Mots-clés (en minuscules) utilisés pour deviner automatiquement quelle
   * colonne du fichier uploadé correspond à ce champ. La détection compare
   * chaque en-tête de colonne (en minuscules) et retient la première qui
   * contient un de ces mots-clés.
   */
  guessKeywords: string[]
}

export type StatutLigne = 'ok' | 'erreur' | 'doublon' | 'avertissement'

export interface LignePreview {
  index: number
  valeurs: Record<string, string>
  statut: StatutLigne
  message?: string
  /** Pour les doublons : action choisie par l'admin avant confirmation */
  action?: 'ignorer' | 'mettreAJour'
}

interface ImportModalProps {
  open: boolean
  onClose: () => void
  title: string
  /** Champs attendus par le backend, dans l'ordre d'affichage de l'étape de correspondance */
  fields: ImportField[]
  /** Endpoint appelé pour la prévisualisation ET la confirmation (voir `mode` dans le corps de la requête) */
  apiEndpoint: string
  /** Nom du fichier modèle proposé au téléchargement (doit exister dans /public) */
  templateHref?: string
  onImported?: (resume: { crees: number; misAJour: number; ignores: number; erreurs: number }) => void
}

type Etape = 'upload' | 'mapping' | 'grille' | 'preview' | 'resultat'
type ModeSaisie = 'fichier' | 'grille' | null

const MAX_LIGNES = 5000
const LIGNES_GRILLE_INITIALES = 6

function ligneVide(fields: ImportField[]): Record<string, string> {
  const ligne: Record<string, string> = {}
  for (const champ of fields) ligne[champ.key] = ''
  return ligne
}

export default function ImportModal({
  open,
  onClose,
  title,
  fields,
  apiEndpoint,
  templateHref,
  onImported,
}: ImportModalProps) {
  const { showToast } = useToast()

  const [etape, setEtape] = useState<Etape>('upload')
  const [modeSaisie, setModeSaisie] = useState<ModeSaisie>(null)
  const [nomFichier, setNomFichier] = useState('')
  const [entetes, setEntetes] = useState<string[]>([])
  const [lignesBrutes, setLignesBrutes] = useState<string[][]>([])
  const [mapping, setMapping] = useState<Record<string, string>>({}) // fieldKey -> entete choisie
  const [grilleLignes, setGrilleLignes] = useState<Record<string, string>[]>([])
  const [lignesPreview, setLignesPreview] = useState<LignePreview[]>([])
  const [chargement, setChargement] = useState(false)
  const [resume, setResume] = useState<{ crees: number; misAJour: number; ignores: number; erreurs: number } | null>(null)

  const reinitialiser = useCallback(() => {
    setEtape('upload')
    setModeSaisie(null)
    setNomFichier('')
    setEntetes([])
    setLignesBrutes([])
    setMapping({})
    setGrilleLignes([])
    setLignesPreview([])
    setResume(null)
  }, [])

  const fermer = () => {
    reinitialiser()
    onClose()
  }

  const ouvrirGrille = () => {
    setModeSaisie('grille')
    setGrilleLignes(Array.from({ length: LIGNES_GRILLE_INITIALES }, () => ligneVide(fields)))
    setEtape('grille')
  }

  // ─── Étape 1 : upload + parsing ────────────────────────────────────────
  const handleFichier = async (fichier: File) => {
    setChargement(true)
    try {
      const XLSX = await import('xlsx')
      const buffer = await fichier.arrayBuffer()
      const classeur = XLSX.read(buffer, { type: 'array' })
      const feuille = classeur.Sheets[classeur.SheetNames[0]]
      const donnees: string[][] = XLSX.utils.sheet_to_json(feuille, {
        header: 1,
        raw: false,
        defval: '',
      })

      if (donnees.length < 2) {
        showToast('Le fichier ne contient aucune ligne de données', 'error')
        setChargement(false)
        return
      }

      const [ligneEntetes, ...reste] = donnees
      const lignesUtiles = reste.filter((l) => l.some((cellule) => String(cellule).trim() !== ''))

      if (lignesUtiles.length > MAX_LIGNES) {
        showToast(`Fichier trop volumineux : ${lignesUtiles.length} lignes (max ${MAX_LIGNES})`, 'error')
        setChargement(false)
        return
      }

      const entetesNettoyees = ligneEntetes.map((e) => String(e).trim())
      setEntetes(entetesNettoyees)
      setLignesBrutes(lignesUtiles)
      setNomFichier(fichier.name)
      setModeSaisie('fichier')

      // Détection automatique de la correspondance de colonnes
      const mappingAuto: Record<string, string> = {}
      for (const champ of fields) {
        const trouve = entetesNettoyees.find((entete) =>
          champ.guessKeywords.some((motCle) => entete.toLowerCase().includes(motCle))
        )
        if (trouve) mappingAuto[champ.key] = trouve
      }
      setMapping(mappingAuto)
      setEtape('mapping')
    } catch {
      showToast('Impossible de lire ce fichier — verifie qu\'il s\'agit bien d\'un .xlsx ou .csv valide', 'error')
    } finally {
      setChargement(false)
    }
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    const fichier = e.dataTransfer.files?.[0]
    if (fichier) handleFichier(fichier)
  }

  const envoyerPourPreview = async (lignesAValider: Record<string, string>[]) => {
    setChargement(true)
    try {
      const res = await fetch(apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'preview', lignes: lignesAValider }),
      })
      const json = await res.json()

      if (!res.ok) {
        showToast(json.error || 'Erreur lors de la validation', 'error')
        return
      }

      const previewAvecAction: LignePreview[] = (json.data?.lignes || []).map((l: LignePreview) => ({
        ...l,
        action: l.statut === 'doublon' ? 'ignorer' : undefined,
      }))
      setLignesPreview(previewAvecAction)
      setEtape('preview')
    } catch {
      showToast('Erreur reseau pendant la validation', 'error')
    } finally {
      setChargement(false)
    }
  }

  const passerAPreviewDepuisFichier = () => {
    const lignesMappees = lignesBrutes.map((ligne) => {
      const valeurs: Record<string, string> = {}
      for (const champ of fields) {
        const entete = mapping[champ.key]
        const colIndex = entete ? entetes.indexOf(entete) : -1
        valeurs[champ.key] = colIndex >= 0 ? String(ligne[colIndex] ?? '').trim() : ''
      }
      return valeurs
    })
    return envoyerPourPreview(lignesMappees)
  }

  // ─── Étape grille : saisie manuelle ────────────────────────────────────
  const modifierCelluleGrille = (rowIndex: number, key: string, valeur: string) => {
    setGrilleLignes((prev) =>
      prev.map((ligne, i) => (i === rowIndex ? { ...ligne, [key]: valeur } : ligne))
    )
  }

  const ajouterLigneGrille = () => {
    setGrilleLignes((prev) => [...prev, ligneVide(fields)])
  }

  const supprimerLigneGrille = (rowIndex: number) => {
    setGrilleLignes((prev) => prev.filter((_, i) => i !== rowIndex))
  }

  /**
   * Colle un bloc de texte (copie depuis Excel, Google Sheets, ou meme du
   * texte brut separe par tabulations/retours a la ligne) a partir d'une
   * cellule donnee, en remplissant les cellules suivantes ligne par ligne
   * et colonne par colonne — comportement standard d'un tableur.
   */
  const collerDansGrille = (rowIndex: number, colIndex: number, e: React.ClipboardEvent<HTMLInputElement>) => {
    const texte = e.clipboardData.getData('text')
    if (!texte.includes('\t') && !texte.includes('\n')) return // collage simple, laisser le comportement par defaut

    e.preventDefault()
    const lignesCollees = texte.replace(/\r/g, '').split('\n').filter((l) => l !== '')

    setGrilleLignes((prev) => {
      const copie = [...prev.map((l) => ({ ...l }))]
      lignesCollees.forEach((ligneTexte, i) => {
        const cellules = ligneTexte.split('\t')
        const cibleIndex = rowIndex + i
        while (cibleIndex >= copie.length) copie.push(ligneVide(fields))
        cellules.forEach((valeur, j) => {
          const champ = fields[colIndex + j]
          if (champ) copie[cibleIndex][champ.key] = valeur.trim()
        })
      })
      return copie
    })
  }

  const passerAPreviewDepuisGrille = () => {
    const lignesNonVides = grilleLignes.filter((ligne) =>
      Object.values(ligne).some((v) => v.trim() !== '')
    )
    if (lignesNonVides.length === 0) {
      showToast('Aucune ligne remplie', 'error')
      return
    }
    return envoyerPourPreview(lignesNonVides)
  }

  // ─── Étape mapping (upload fichier) ────────────────────────────────────
  const champsObligatoiresManquants = fields.filter((f) => f.required && !mapping[f.key])

  // ─── Étape 3 : prévisualisation → confirmation ─────────────────────────
  const changerActionDoublon = (index: number, action: 'ignorer' | 'mettreAJour') => {
    setLignesPreview((prev) =>
      prev.map((l) => (l.index === index ? { ...l, action } : l))
    )
  }

  const confirmerImport = async () => {
    setChargement(true)
    try {
      const lignesAEnvoyer = lignesPreview
        .filter((l) => l.statut !== 'erreur')
        .map((l) => ({ valeurs: l.valeurs, action: l.action || 'creer' }))

      const res = await fetch(apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'confirm', lignes: lignesAEnvoyer }),
      })
      const json = await res.json()

      if (!res.ok) {
        showToast(json.error || 'Erreur lors de l\'import', 'error')
        return
      }

      setResume(json.data)
      setEtape('resultat')
      onImported?.(json.data)
    } catch {
      showToast('Erreur reseau pendant l\'import', 'error')
    } finally {
      setChargement(false)
    }
  }

  if (!open) return null

  const nbOk = lignesPreview.filter((l) => l.statut === 'ok').length
  const nbErreurs = lignesPreview.filter((l) => l.statut === 'erreur').length
  const nbDoublons = lignesPreview.filter((l) => l.statut === 'doublon').length
  const nbAvertissements = lignesPreview.filter((l) => l.statut === 'avertissement').length
  const nbImportables = nbOk + nbDoublons + nbAvertissements

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="import-modal-title"
    >
      <div className="absolute inset-0 bg-navy/40" onClick={() => !chargement && fermer()} />

      <div className="relative bg-white rounded-card shadow-lg w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 id="import-modal-title" className="text-lg font-semibold text-navy">{title}</h2>
          <button onClick={fermer} className="text-gray-400 hover:text-gray-600 text-xl leading-none" aria-label="Fermer">×</button>
        </div>

        {/* Indicateur d'étape */}
        <div className="flex gap-1 mb-6">
          {(modeSaisie === 'grille'
            ? (['upload', 'grille', 'preview', 'resultat'] as Etape[])
            : (['upload', 'mapping', 'preview', 'resultat'] as Etape[])
          ).map((e, i, liste) => {
            const etapeIndex = liste.indexOf(etape)
            const actif = i === etapeIndex
            const fait = i < etapeIndex
            return (
              <div
                key={e}
                className={`h-1 flex-1 rounded-full ${actif ? 'bg-mint' : fait ? 'bg-mint/50' : 'bg-gray-200'}`}
              />
            )
          })}
        </div>

        {/* Étape upload */}
        {etape === 'upload' && (
          <div>
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              className="border-2 border-dashed border-gray-300 rounded-card p-8 text-center mb-4"
            >
              <p className="text-sm text-gray-600 mb-2">Glisse ton fichier ici, ou clique pour choisir</p>
              <p className="text-xs text-gray-400 mb-4">.xlsx, .csv — jusqu&apos;a {MAX_LIGNES} lignes</p>
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={(e) => e.target.files?.[0] && handleFichier(e.target.files[0])}
                className="text-sm"
              />
            </div>
            {templateHref && (
              <a
                href={templateHref}
                download
                className="text-sm text-mint-dark hover:underline"
              >
                Telecharger le modele
              </a>
            )}
            <div className="mt-3 pt-3 border-t border-gray-100">
              <button
                onClick={ouvrirGrille}
                className="text-sm text-gray-600 hover:underline"
              >
                Rien a exporter ? Saisir directement en grille →
              </button>
            </div>
          </div>
        )}

        {/* Étape mapping */}
        {etape === 'mapping' && (
          <div>
            <p className="text-sm text-gray-600 mb-4">
              Fichier <span className="font-medium">{nomFichier}</span> — {lignesBrutes.length} ligne(s) detectee(s).
              On a devine la correspondance des colonnes, ajuste si besoin.
            </p>
            <div className="space-y-3 mb-6">
              {fields.map((champ) => (
                <div key={champ.key} className="flex items-center gap-3">
                  <span className="text-sm text-gray-700 w-40 shrink-0">
                    {champ.label}{champ.required && ' *'}
                  </span>
                  <span className="text-gray-400">→</span>
                  <select
                    value={mapping[champ.key] || ''}
                    onChange={(e) => setMapping((prev) => ({ ...prev, [champ.key]: e.target.value }))}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  >
                    <option value="">— Non mappe —</option>
                    {entetes.map((entete) => (
                      <option key={entete} value={entete}>{entete}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
            {champsObligatoiresManquants.length > 0 && (
              <p className="text-sm text-danger mb-4">
                Champs obligatoires non mappes : {champsObligatoiresManquants.map((f) => f.label).join(', ')}
              </p>
            )}
            <div className="flex justify-between">
              <Button variant="secondary" onClick={() => setEtape('upload')}>Retour</Button>
              <Button
                onClick={passerAPreviewDepuisFichier}
                loading={chargement}
                disabled={champsObligatoiresManquants.length > 0}
              >
                Continuer
              </Button>
            </div>
          </div>
        )}

        {/* Étape grille : saisie manuelle */}
        {etape === 'grille' && (
          <div>
            <p className="text-sm text-gray-600 mb-4">
              Remplis les lignes a la main, ou colle un bloc copie depuis n&apos;importe quel tableur
              (une cellule suffit comme point de depart, le collage remplit les cellules suivantes).
            </p>
            <div className="border border-gray-200 rounded-card overflow-x-auto mb-3 max-h-72 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    {fields.map((champ) => (
                      <th key={champ.key} className="text-left px-2 py-2 text-gray-600 font-medium whitespace-nowrap">
                        {champ.label}{champ.required && ' *'}
                      </th>
                    ))}
                    <th className="px-2 py-2 w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {grilleLignes.map((ligne, rowIndex) => (
                    <tr key={rowIndex} className="border-t border-gray-100">
                      {fields.map((champ, colIndex) => (
                        <td key={champ.key} className="p-1">
                          <input
                            type="text"
                            value={ligne[champ.key] || ''}
                            onChange={(e) => modifierCelluleGrille(rowIndex, champ.key, e.target.value)}
                            onPaste={(e) => collerDansGrille(rowIndex, colIndex, e)}
                            className="w-full px-2 py-1 border border-gray-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-mint"
                          />
                        </td>
                      ))}
                      <td className="p-1 text-center">
                        <button
                          onClick={() => supprimerLigneGrille(rowIndex)}
                          className="text-gray-300 hover:text-danger text-sm"
                          aria-label="Supprimer la ligne"
                        >
                          ×
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button
              onClick={ajouterLigneGrille}
              className="text-sm text-mint-dark hover:underline mb-6"
            >
              + Ajouter une ligne
            </button>
            <div className="flex justify-between">
              <Button variant="secondary" onClick={() => setEtape('upload')}>Retour</Button>
              <Button onClick={passerAPreviewDepuisGrille} loading={chargement}>
                Continuer
              </Button>
            </div>
          </div>
        )}

        {/* Étape preview */}
        {etape === 'preview' && (
          <div>
            <p className="text-sm text-gray-600 mb-4">
              {lignesPreview.length} ligne(s) — {nbOk} prete(s), {nbDoublons} doublon(s), {nbAvertissements} a verifier, {nbErreurs} erreur(s).
              Rien n&apos;est encore enregistre.
            </p>
            <div className="border border-gray-200 rounded-card overflow-hidden mb-4 max-h-72 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    {fields.slice(0, 3).map((f) => (
                      <th key={f.key} className="text-left px-3 py-2 text-gray-600 font-medium">{f.label}</th>
                    ))}
                    <th className="text-left px-3 py-2 text-gray-600 font-medium">Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {lignesPreview.map((ligne) => (
                    <tr key={ligne.index} className="border-t border-gray-100">
                      {fields.slice(0, 3).map((f) => (
                        <td key={f.key} className="px-3 py-2 text-gray-700">{ligne.valeurs[f.key] || '—'}</td>
                      ))}
                      <td className="px-3 py-2">
                        {ligne.statut === 'ok' && (
                          <span className="text-xs px-2 py-0.5 rounded bg-success-bg text-success">OK</span>
                        )}
                        {ligne.statut === 'erreur' && (
                          <span className="text-xs px-2 py-0.5 rounded bg-danger-bg text-danger" title={ligne.message}>
                            Erreur{ligne.message ? ` — ${ligne.message}` : ''}
                          </span>
                        )}
                        {ligne.statut === 'doublon' && (
                          <div className="flex items-center gap-2">
                            <span className="text-xs px-2 py-0.5 rounded bg-warning-bg text-warning">Doublon</span>
                            <select
                              value={ligne.action}
                              onChange={(e) => changerActionDoublon(ligne.index, e.target.value as 'ignorer' | 'mettreAJour')}
                              className="text-xs border border-gray-300 rounded px-1 py-0.5"
                            >
                              <option value="ignorer">Ignorer</option>
                              <option value="mettreAJour">Mettre a jour</option>
                            </select>
                          </div>
                        )}
                        {ligne.statut === 'avertissement' && (
                          <span
                            className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-600"
                            title={ligne.message}
                          >
                            A verifier{ligne.message ? ` — ${ligne.message}` : ''}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-between">
              <Button variant="secondary" onClick={() => setEtape(modeSaisie === 'grille' ? 'grille' : 'mapping')}>Retour</Button>
              <Button onClick={confirmerImport} loading={chargement} disabled={nbImportables === 0}>
                Confirmer l&apos;import ({nbImportables} ligne{nbImportables > 1 ? 's' : ''})
              </Button>
            </div>
          </div>
        )}

        {/* Étape résultat */}
        {etape === 'resultat' && resume && (
          <div>
            <div className="grid grid-cols-4 gap-3 mb-6">
              <div className="bg-gray-50 rounded-card p-3 text-center">
                <p className="text-xs text-gray-500 mb-1">Crees</p>
                <p className="text-xl font-semibold text-success">{resume.crees}</p>
              </div>
              <div className="bg-gray-50 rounded-card p-3 text-center">
                <p className="text-xs text-gray-500 mb-1">Mis a jour</p>
                <p className="text-xl font-semibold text-navy">{resume.misAJour}</p>
              </div>
              <div className="bg-gray-50 rounded-card p-3 text-center">
                <p className="text-xs text-gray-500 mb-1">Ignores</p>
                <p className="text-xl font-semibold text-warning">{resume.ignores}</p>
              </div>
              <div className="bg-gray-50 rounded-card p-3 text-center">
                <p className="text-xs text-gray-500 mb-1">Erreurs</p>
                <p className="text-xl font-semibold text-danger">{resume.erreurs}</p>
              </div>
            </div>
            <div className="flex justify-end">
              <Button onClick={fermer}>Fermer</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}