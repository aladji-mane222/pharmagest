
'use client'

import { useEffect, useState, useRef, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { formatMontant, formatDateTime, formatDate } from '@/lib/utils'
import { exporterExcel, exporterCSV } from '@/lib/export'
import { pdf } from '@react-pdf/renderer'
import CommandesPDF from '@/components/fournisseurs/CommandesPDF'
import Modal from '@/components/ui/Modal'
import { TOLERANCE_RETARD_JOURS } from '@/lib/livraison'

interface Commande {
  id: string
  statut: string
  montantTotal: number
  createdAt: string
  dateLivraisonPrevue: string | null
  dateReception: string | null
  fournisseur: { nom: string }
  lignes: {
    id: string
    quantite: number
    quantiteRecue: number | null
    prixUnitaire: number
    medicamentId: string
    medicament: { nom: string } | null
  }[]
}

interface SousLotForm {
  quantite: string
  datePeremption: string
  numeroLot: string
}

interface LigneReception {
  ligneId: string
  nom: string
  quantiteCommandee: number
  sousLots: SousLotForm[]
}

// Seuil de peremption proche a la reception : reprend exactement le seuil
// deja utilise ailleurs dans l'app (/stock lotsCritiques, alertes cron) —
// 90 jours — pour rester coherent plutot que d'inventer un autre chiffre.
const SEUIL_PEREMPTION_PROCHE_JOURS = 90

function estPeremptionProche(dateStr: string): boolean {
  if (!dateStr) return false
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return false
  const diffJours = (d.getTime() - Date.now()) / (24 * 60 * 60 * 1000)
  return diffJours >= 0 && diffJours <= SEUIL_PEREMPTION_PROCHE_JOURS
}

// Suggestion de date de livraison prevue a la creation : +7 jours,
// editable/effaçable par l'admin. Si effacee, on envoie null — pas de
// date fabriquee silencieusement (voir le bug corrige a la reception).
function suggestionDateLivraison(): string {
  const d = new Date()
  d.setDate(d.getDate() + 7)
  return d.toISOString().slice(0, 10)
}

function joursDeRetard(dateLivraisonPrevue: string | null, dateReference: Date): number {
  if (!dateLivraisonPrevue) return 0
  const prevue = new Date(dateLivraisonPrevue)
  const diffMs = dateReference.getTime() - prevue.getTime()
  return Math.floor(diffMs / (24 * 60 * 60 * 1000))
}

// Tolerance de 2 jours avant de considerer une livraison en retard
// -> importee de src/lib/livraison.ts, partagee avec le calcul de
// fiabilite fournisseur pour ne jamais diverger.

const LABELS_STATUT: Record<string, string> = {
  BROUILLON: 'Brouillon',
  ENVOYEE:   'Envoyée',
  RECUE:     'Reçue',
  ANNULEE:   'Annulée',
}

interface Fournisseur {
  id: string
  nom: string
}

interface Medicament {
  id: string
  nom: string
  prixAchat: number | null
  stockTotal: number
}

interface Suggestion {
  medicamentId: string
  nom: string
  stockActuel: number
  stockMinimum: number
  quantiteSuggeree: number
}

interface LigneForm {
  medicamentId: string
  quantite: string
  prixUnitaire: string
}

// Recherche autocompletee de medicament (Phase 3.4) — remplace le <select>
// brut qui obligeait a faire defiler tout le catalogue. Filtrage cote
// client puisque la liste complete est deja chargee en memoire (voir le
// fetch limit=2000 plus haut) ; affiche stock actuel + prix d'achat
// habituel pendant la frappe, comme prevu au plan.
function AutocompleteMedicament({
  medicaments,
  valeur,
  onChoisir,
}: {
  medicaments: Medicament[]
  valeur: string
  onChoisir: (medicamentId: string) => void
}) {
  const medicamentSelectionne = medicaments.find((m) => m.id === valeur)
  const [texte, setTexte]     = useState(medicamentSelectionne?.nom || '')
  const [ouvert, setOuvert]   = useState(false)
  const conteneurRef = useRef<HTMLDivElement>(null)

  // Si la selection change depuis l'exterieur (ex: "Utiliser les
  // suggestions"), on resynchronise le texte affiche
  useEffect(() => {
    setTexte(medicamentSelectionne?.nom || '')
  }, [valeur]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const surClicExterieur = (e: MouseEvent) => {
      if (conteneurRef.current && !conteneurRef.current.contains(e.target as Node)) {
        setOuvert(false)
        // Si le texte tape ne correspond plus a la selection valide, on
        // revient a l'affichage du dernier choix connu plutot que de
        // laisser un texte libre non selectionne
        setTexte(medicamentSelectionne?.nom || '')
      }
    }
    document.addEventListener('mousedown', surClicExterieur)
    return () => document.removeEventListener('mousedown', surClicExterieur)
  }, [medicamentSelectionne])

  const resultats = texte.trim().length === 0
    ? []
    : medicaments
        .filter((m) => m.nom.toLowerCase().includes(texte.trim().toLowerCase()))
        .slice(0, 20)

  // Selection automatique si un seul medicament correspond — evite de
  // devoir cliquer ou taper le nom en entier quand la saisie suffit deja
  // a lever toute ambiguite. Seuil de 2 caracteres pour ne pas
  // selectionner trop tot sur une simple lettre qui matcherait par
  // hasard un seul medicament dans un petit catalogue de test.
  useEffect(() => {
    if (texte.trim().length < 2) return
    if (resultats.length === 1 && resultats[0].id !== valeur) {
      onChoisir(resultats[0].id)
      setTexte(resultats[0].nom)
      setOuvert(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [texte])

  return (
    <div className="relative" ref={conteneurRef}>
      <input
        type="text"
        value={texte}
        placeholder="Rechercher..."
        onChange={(e) => { setTexte(e.target.value); setOuvert(true) }}
        onFocus={() => setOuvert(true)}
        className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
      />
      {ouvert && resultats.length > 0 && (
        <div className="absolute z-20 mt-1 w-full max-h-56 overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-lg">
          {resultats.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => {
                onChoisir(m.id)
                setTexte(m.nom)
                setOuvert(false)
              }}
              className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex justify-between items-center gap-2"
            >
              <span className="truncate">{m.nom}</span>
              <span className="text-xs text-gray-400 shrink-0">
                Stock {m.stockTotal}{m.prixAchat ? ` · ${formatMontant(m.prixAchat)}` : ''}
              </span>
            </button>
          ))}
        </div>
      )}
      {ouvert && texte.trim().length > 0 && resultats.length === 0 && (
        <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg px-3 py-2 text-sm text-gray-400">
          Aucun médicament trouvé
        </div>
      )}
    </div>
  )
}

function CommandesPageInner() {
  const searchParams = useSearchParams()
  const filtreFournisseurIdInitial = searchParams.get('fournisseurId') || ''
  const commandeCibleId            = searchParams.get('commandeId') || ''
  const commandeCibleRef           = useRef<HTMLTableRowElement>(null)

  const [commandes,     setCommandes]     = useState<Commande[]>([])
  const [fournisseurs,  setFournisseurs]  = useState<Fournisseur[]>([])
  const [medicaments,   setMedicaments]   = useState<Medicament[]>([])
  const [loading,       setLoading]       = useState(true)
  const [showForm,      setShowForm]      = useState(false)
  const [fournisseurId, setFournisseurId] = useState('')
  const [lignes,        setLignes]        = useState<LigneForm[]>([
    { medicamentId: '', quantite: '1', prixUnitaire: '' },
  ])
  const [dateLivraisonPrevue, setDateLivraisonPrevue] = useState<string>(suggestionDateLivraison())
  const [saving,        setSaving]        = useState(false)
  const [erreur,        setErreur]        = useState<string | null>(null)

  // ── Modale de reception reelle ──
  const [commandeAReceptionner, setCommandeAReceptionner] = useState<Commande | null>(null)
  const [lignesReception,       setLignesReception]       = useState<LigneReception[]>([])
  const [erreurReception,       setErreurReception]       = useState<string | null>(null)
  const [savingReception,       setSavingReception]       = useState(false)

  // ── Filtre + export unifies (Phase 3.3 + 3.7 suite) ──
  // Un seul jeu d'etats pilote a la fois CE QUI EST AFFICHE a l'ecran et
  // ce qui part dans un export — demande explicite de Nabe le 21/07 : il
  // n'existait avant qu'un filtre "pour l'export" sans effet sur la liste
  // visible, ce qui n'etait pas un vrai systeme de filtre pour l'usage
  // quotidien.
  const [filtreOuvert,     setFiltreOuvert]     = useState(!!filtreFournisseurIdInitial)
  const [filtreFournisseur,setFiltreFournisseur]= useState(filtreFournisseurIdInitial)
  const [filtreStatut,     setFiltreStatut]     = useState('')
  const [filtreDateDebut,  setFiltreDateDebut]  = useState('')
  const [filtreDateFin,    setFiltreDateFin]    = useState('')
  const [exportEnCours,    setExportEnCours]    = useState(false)
  const [nomPharmacie,     setNomPharmacie]     = useState('Ma Pharmacie')

  const filtreActif = !!(filtreFournisseur || filtreStatut || filtreDateDebut || filtreDateFin)

  const [showSuggestions, setShowSuggestions] = useState(false)
  const [suggestions,     setSuggestions]     = useState<Suggestion[]>([])
  const [loadingSugg,     setLoadingSugg]     = useState(false)

  useEffect(() => {
    fetch('/api/parametres')
      .then((r) => r.json())
      .then((json) => {
        const nom = json.data?.nom ?? json.data?.pharmacie?.nom
        if (nom) setNomPharmacie(nom)
      })
      .catch(() => {})
  }, [])

  // Fournisseurs + catalogue medicaments : independants des filtres,
  // charges une seule fois
  useEffect(() => {
    Promise.all([
      fetch('/api/fournisseurs').then((r) => r.json()),
      // Bug corrige 19/07/2026 : le parametre etait "limite" (jamais lu par
      // l'API qui attend "limit"), donc retombait sur la valeur par defaut
      // de 20 medicaments — la plupart des suggestions issues du catalogue
      // complet ne matchaient alors aucune option du menu deroulant.
      // 2000 couvre un catalogue de pharmacie realiste.
      fetch('/api/medicaments?limit=2000').then((r) => r.json()),
    ]).then(([four, meds]) => {
      setFournisseurs(four.data || [])
      setMedicaments(meds.data?.medicaments || [])
    })
  }, [])

  // Liste des commandes affichees : reagit a chaque changement de filtre.
  // Un filtre actif retire le plafond de 20 (voir filtreActif cote API) —
  // "tous=1" couvre le cas particulier d'un lien vers une commande precise
  // (origine d'un mouvement de stock) qui pourrait etre plus ancienne que
  // les 20 dernieres, sans filtre explicite par ailleurs.
  useEffect(() => {
    const params = new URLSearchParams()
    if (filtreFournisseur) params.set('fournisseurId', filtreFournisseur)
    if (filtreStatut)      params.set('statut',        filtreStatut)
    if (filtreDateDebut)   params.set('dateDebut',     filtreDateDebut)
    if (filtreDateFin)     params.set('dateFin',       filtreDateFin)
    if (!filtreActif && commandeCibleId) params.set('tous', '1')

    setLoading(true)
    fetch(`/api/commandes?${params.toString()}`)
      .then((r) => r.json())
      .then((json) => {
        setCommandes(json.data || [])
        setLoading(false)
      })
  }, [filtreFournisseur, filtreStatut, filtreDateDebut, filtreDateFin, filtreActif, commandeCibleId])

  // Si on arrive depuis un lien "Origine" d'un mouvement de stock lie a
  // une commande precise, on n'a pas de fiche dediee (voir tache a part
  // dans PLAN-CONSOLIDATION-SAAS.md) — a defaut, on scrolle jusqu'a la
  // ligne concernee et on la met en evidence quelques secondes.
  useEffect(() => {
    if (!commandeCibleId || commandes.length === 0) return
    const t = setTimeout(() => {
      commandeCibleRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 100)
    return () => clearTimeout(t)
  }, [commandeCibleId, commandes])

  // Quand on sélectionne un médicament sur une ligne, pré-remplir le prix d'achat
  const onMedicamentChange = (index: number, medicamentId: string) => {
    const med = medicaments.find((m) => m.id === medicamentId)
    setLignes(lignes.map((l, i) =>
      i === index
        ? { ...l, medicamentId, prixUnitaire: med?.prixAchat ? String(med.prixAchat) : '' }
        : l
    ))
  }

  const ajouterLigne = () => {
    setLignes([...lignes, { medicamentId: '', quantite: '1', prixUnitaire: '' }])
  }

  const supprimerLigne = (index: number) => {
    if (lignes.length === 1) return
    setLignes(lignes.filter((_, i) => i !== index))
  }

  const toggleSuggestions = () => {
    if (showSuggestions) { setShowSuggestions(false); return }
    setShowSuggestions(true)
    setLoadingSugg(true)
    fetch('/api/commandes/suggerer')
      .then((r) => r.json())
      .then((json) => {
        setSuggestions(json.data || [])
        setLoadingSugg(false)
      })
  }

  // Auto-remplir le formulaire depuis les suggestions
  const utiliserSuggestions = () => {
    if (suggestions.length === 0) return
    const nouvellesLignes: LigneForm[] = suggestions.map((s) => {
      const med = medicaments.find((m) => m.id === s.medicamentId)
      return {
        medicamentId: s.medicamentId,
        quantite:     String(s.quantiteSuggeree),
        prixUnitaire: med?.prixAchat ? String(med.prixAchat) : '',
      }
    })
    setLignes(nouvellesLignes)
    setShowForm(true)
    setShowSuggestions(false)
  }

  const creerCommande = async () => {
    setErreur(null)
    if (!fournisseurId) { setErreur('Choisir un fournisseur'); return }

    const lignesValides = lignes.filter((l) => l.medicamentId && l.quantite && l.prixUnitaire)
    if (lignesValides.length === 0) {
      setErreur('Ajouter au moins une ligne avec médicament, quantité et prix')
      return
    }

    const lignesIncompletes = lignes.filter((l) => l.medicamentId && (!l.quantite || !l.prixUnitaire))
    if (lignesIncompletes.length > 0) {
      setErreur('Certaines lignes sont incomplètes (quantité ou prix manquant)')
      return
    }

    setSaving(true)
    const res = await fetch('/api/commandes', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        fournisseurId,
        dateLivraisonPrevue: dateLivraisonPrevue || null,
        lignes: lignesValides.map((l) => ({
          medicamentId: l.medicamentId,
          quantite:     parseInt(l.quantite),
          prixUnitaire: parseFloat(l.prixUnitaire),
        })),
      }),
    })
    const json = await res.json()
    if (res.ok) {
      setCommandes([json.data, ...commandes])
      setShowForm(false)
      setFournisseurId('')
      setLignes([{ medicamentId: '', quantite: '1', prixUnitaire: '' }])
      setDateLivraisonPrevue(suggestionDateLivraison())
    } else {
      setErreur(json.error || 'Erreur lors de la création')
    }
    setSaving(false)
  }

  const changerStatut = async (id: string, statut: string) => {
    const res = await fetch(`/api/commandes/${id}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ statut }),
    })
    if (res.ok) {
      setCommandes(commandes.map((c) => c.id === id ? { ...c, statut } : c))
    }
  }

  const ouvrirReception = (cmd: Commande) => {
    setErreurReception(null)
    setCommandeAReceptionner(cmd)
    setLignesReception(
      cmd.lignes.map((l) => ({
        ligneId: l.id,
        nom: l.medicament?.nom || 'Médicament',
        quantiteCommandee: l.quantite,
        // Un seul sous-lot pre-rempli avec la quantite commandee par
        // confort — modifiable, et l'admin peut en ajouter d'autres si le
        // fournisseur a livre le meme medicament avec plusieurs dates de
        // peremption differentes dans la meme reception.
        sousLots: [{ quantite: String(l.quantite), datePeremption: '', numeroLot: '' }],
      }))
    )
  }

  const fermerReception = () => {
    if (savingReception) return
    setCommandeAReceptionner(null)
    setLignesReception([])
    setErreurReception(null)
  }

  const ajouterSousLot = (ligneIndex: number) => {
    setLignesReception((prev) =>
      prev.map((l, i) =>
        i === ligneIndex
          ? { ...l, sousLots: [...l.sousLots, { quantite: '', datePeremption: '', numeroLot: '' }] }
          : l
      )
    )
  }

  const supprimerSousLot = (ligneIndex: number, sousLotIndex: number) => {
    setLignesReception((prev) =>
      prev.map((l, i) =>
        i === ligneIndex
          ? { ...l, sousLots: l.sousLots.filter((_, si) => si !== sousLotIndex) }
          : l
      )
    )
  }

  const modifierSousLot = (
    ligneIndex: number,
    sousLotIndex: number,
    champ: 'quantite' | 'datePeremption' | 'numeroLot',
    valeur: string
  ) => {
    setLignesReception((prev) =>
      prev.map((l, i) =>
        i === ligneIndex
          ? {
              ...l,
              sousLots: l.sousLots.map((sl, si) =>
                si === sousLotIndex ? { ...sl, [champ]: valeur } : sl
              ),
            }
          : l
      )
    )
  }

  const totalRecuLigne = (l: LigneReception) =>
    l.sousLots.reduce((s, sl) => s + (parseInt(sl.quantite) || 0), 0)

  const confirmerReception = async () => {
    if (!commandeAReceptionner) return
    setErreurReception(null)

    for (const l of lignesReception) {
      for (const sl of l.sousLots) {
        if (sl.quantite === '' || parseInt(sl.quantite) < 0) {
          setErreurReception(`Quantité manquante ou invalide pour ${l.nom}`)
          return
        }
        if (parseInt(sl.quantite) > 0 && !sl.datePeremption) {
          setErreurReception(`Date de péremption manquante pour ${l.nom}`)
          return
        }
      }
    }

    setSavingReception(true)
    const res = await fetch(`/api/commandes/${commandeAReceptionner.id}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        statut: 'RECUE',
        lignes: lignesReception.map((l) => ({
          ligneId: l.ligneId,
          sousLots: l.sousLots.map((sl) => ({
            quantite: parseInt(sl.quantite) || 0,
            datePeremption: sl.datePeremption,
            numeroLot: sl.numeroLot.trim() || null,
          })),
        })),
      }),
    })
    const json = await res.json()
    if (res.ok) {
      setCommandes(commandes.map((c) =>
        c.id === commandeAReceptionner.id ? { ...c, statut: 'RECUE' } : c
      ))
      if (json.data?.ecarts?.length > 0) {
        setErreurReception(
          `Commande réceptionnée avec ${json.data.ecarts.length} écart(s) de livraison — voir le journal d'audit.`
        )
        setTimeout(() => fermerReception(), 2500)
      } else {
        fermerReception()
      }
    } else {
      setErreurReception(json.error || 'Erreur lors de la réception')
    }
    setSavingReception(false)
  }

  // Export historique commandes (Phase 3.3) : appel dedie avec filtres,
  // La liste "commandes" est deja filtree en temps reel (voir le
  // useEffect au-dessus) — l'export reutilise directement cet etat au
  // lieu de refaire un appel reseau separe avec les memes filtres.
  const lancerExport = async (format: 'excel' | 'csv' | 'pdf') => {
    if (commandes.length === 0) return
    setExportEnCours(true)
    const liste = commandes

    if (format === 'pdf') {
      const nomFournisseurFiltre = filtreFournisseur
        ? fournisseurs.find((f) => f.id === filtreFournisseur)?.nom
        : null
      const filtreLabel = [
        nomFournisseurFiltre ? `Fournisseur : ${nomFournisseurFiltre}` : null,
        filtreStatut ? `Statut : ${LABELS_STATUT[filtreStatut] ?? filtreStatut}` : null,
        (filtreDateDebut || filtreDateFin) ? `Période : ${filtreDateDebut || '...'} au ${filtreDateFin || '...'}` : null,
      ].filter(Boolean).join(' — ') || null

      const lignesPdf = liste.map((c) => ({
        fournisseur:         c.fournisseur.nom,
        dateCommande:        formatDate(c.createdAt),
        dateLivraisonPrevue: c.dateLivraisonPrevue ? formatDate(c.dateLivraisonPrevue) : '',
        dateReceptionReelle: c.dateReception ? formatDate(c.dateReception) : '',
        statut:              LABELS_STATUT[c.statut] ?? c.statut,
        montantTotal:        c.montantTotal,
        ecart: c.lignes.some(
          (l) => l.quantiteRecue !== null && l.quantiteRecue !== undefined && l.quantiteRecue !== l.quantite
        ),
      }))

      const blob = await pdf(
        <CommandesPDF lignes={lignesPdf} nomPharmacie={nomPharmacie} filtreLabel={filtreLabel} />
      ).toBlob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'commandes-fournisseurs.pdf'
      a.click()
      URL.revokeObjectURL(url)
      setExportEnCours(false)
      return
    }

    const lignesExport = liste.map((c) => {
      const ecart = c.lignes.some(
        (l) => l.quantiteRecue !== null && l.quantiteRecue !== undefined && l.quantiteRecue !== l.quantite
      )
      return {
        Fournisseur:              c.fournisseur.nom,
        'Date commande':          formatDate(c.createdAt),
        'Date livraison prévue':  c.dateLivraisonPrevue ? formatDate(c.dateLivraisonPrevue) : '',
        'Date réception réelle':  c.dateReception ? formatDate(c.dateReception) : '',
        Statut:                   LABELS_STATUT[c.statut] ?? c.statut,
        'Montant total (GNF)':    c.montantTotal,
        'Écart de livraison':     ecart ? 'Oui' : 'Non',
      }
    })

    if (format === 'excel') await exporterExcel(lignesExport, 'commandes-fournisseurs')
    else                    exporterCSV(lignesExport, 'commandes-fournisseurs')
    setExportEnCours(false)
  }

  const statutCouleur = (statut: string) => {
    switch (statut) {
      case 'BROUILLON': return 'bg-gray-100 text-gray-700'
      case 'ENVOYEE':   return 'bg-blue-100 text-blue-700'
      case 'RECUE':     return 'bg-green-100 text-green-700'
      case 'ANNULEE':   return 'bg-red-100 text-red-700'
      default:          return 'bg-gray-100 text-gray-700'
    }
  }

  const badgeLivraison = (cmd: Commande) => {
    if (!cmd.dateLivraisonPrevue) {
      return <span className="text-gray-300 text-xs">—</span>
    }
    if (cmd.statut === 'RECUE' && cmd.dateReception) {
      const retard = joursDeRetard(cmd.dateLivraisonPrevue, new Date(cmd.dateReception))
      if (retard > TOLERANCE_RETARD_JOURS) {
        return (
          <span className="px-2 py-1 bg-red-100 text-red-600 rounded-full text-xs">
            Reçue en retard ({retard}j)
          </span>
        )
      }
      return <span className="px-2 py-1 bg-green-100 text-green-600 rounded-full text-xs">Reçue à temps</span>
    }
    if (cmd.statut === 'ENVOYEE') {
      const retard = joursDeRetard(cmd.dateLivraisonPrevue, new Date())
      if (retard > TOLERANCE_RETARD_JOURS) {
        return (
          <span className="px-2 py-1 bg-orange-100 text-orange-600 rounded-full text-xs">
            En retard ({retard}j)
          </span>
        )
      }
    }
    return (
      <span className="text-gray-500 text-xs">
        {new Date(cmd.dateLivraisonPrevue).toLocaleDateString('fr-FR')}
      </span>
    )
  }

  const couleurStock = (actuel: number) =>
    actuel === 0 ? 'text-red-600 font-semibold' : 'text-orange-600 font-semibold'

  const montantFormulaire = lignes.reduce((sum, l) => {
    const q = parseInt(l.quantite) || 0
    const p = parseFloat(l.prixUnitaire) || 0
    return sum + q * p
  }, 0)

  if (loading) return <div className="p-8 text-gray-400">Chargement...</div>

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Commandes Fournisseurs</h1>
        <div className="flex gap-3">
          <button
            onClick={toggleSuggestions}
            className={`px-4 py-2 rounded-lg text-sm border transition-colors ${
              showSuggestions
                ? 'bg-amber-50 border-amber-300 text-amber-700'
                : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            📋 Commandes suggérées
          </button>
          <button
            onClick={() => setFiltreOuvert(!filtreOuvert)}
            className={`px-4 py-2 rounded-lg text-sm border transition-colors ${
              filtreOuvert || filtreActif
                ? 'bg-blue-50 border-blue-300 text-blue-700'
                : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            🔍 Filtrer{filtreActif ? ' (actif)' : ''}
          </button>
          <button
            onClick={() => { setShowForm(!showForm); setErreur(null) }}
            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
          >
            + Nouvelle commande
          </button>
        </div>
      </div>

      {filtreActif && (
        <div className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-lg px-4 py-2 mb-6 text-sm">
          <span className="text-gray-600">
            Filtré : {[
              filtreFournisseur ? fournisseurs.find((f) => f.id === filtreFournisseur)?.nom : null,
              filtreStatut ? LABELS_STATUT[filtreStatut] : null,
              (filtreDateDebut || filtreDateFin) ? `du ${filtreDateDebut || '...'} au ${filtreDateFin || '...'}` : null,
            ].filter(Boolean).join(' — ')}
            {' '}({commandes.length} commande{commandes.length > 1 ? 's' : ''})
          </span>
          <button
            onClick={() => {
              setFiltreFournisseur('')
              setFiltreStatut('')
              setFiltreDateDebut('')
              setFiltreDateFin('')
            }}
            className="text-green-600 hover:underline"
          >
            Réinitialiser ×
          </button>
        </div>
      )}

      {/* Panneau filtre + export */}
      {filtreOuvert && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 mb-6">
          <h2 className="text-base font-semibold text-blue-800 mb-1">Filtrer les commandes</h2>
          <p className="text-sm text-blue-700 mb-4">
            S'applique à la liste ci-dessous ET aux exports. Sans filtre, seules les 20 commandes les plus récentes sont affichées.
          </p>
          <div className="flex flex-wrap items-end gap-4 mb-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Fournisseur</label>
              <select
                value={filtreFournisseur}
                onChange={(e) => setFiltreFournisseur(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm w-48"
              >
                <option value="">Tous les fournisseurs</option>
                {fournisseurs.map((f) => (
                  <option key={f.id} value={f.id}>{f.nom}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Statut</label>
              <select
                value={filtreStatut}
                onChange={(e) => setFiltreStatut(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm w-40"
              >
                <option value="">Tous les statuts</option>
                {Object.entries(LABELS_STATUT).map(([code, label]) => (
                  <option key={code} value={code}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Du</label>
              <input
                type="date"
                value={filtreDateDebut}
                onChange={(e) => setFiltreDateDebut(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Au</label>
              <input
                type="date"
                value={filtreDateFin}
                onChange={(e) => setFiltreDateFin(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => lancerExport('excel')}
              disabled={exportEnCours}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
            >
              {exportEnCours ? 'Export en cours...' : '📊 Exporter en Excel'}
            </button>
            <button
              onClick={() => lancerExport('csv')}
              disabled={exportEnCours}
              className="px-4 py-2 bg-white border border-blue-300 text-blue-700 rounded-lg text-sm hover:bg-blue-50 disabled:opacity-50"
            >
              {exportEnCours ? 'Export en cours...' : '📄 Exporter en CSV'}
            </button>
            <button
              onClick={() => lancerExport('pdf')}
              disabled={exportEnCours}
              className="px-4 py-2 bg-white border border-blue-300 text-blue-700 rounded-lg text-sm hover:bg-blue-50 disabled:opacity-50"
            >
              {exportEnCours ? 'Export en cours...' : '🧾 Exporter en PDF'}
            </button>
          </div>
        </div>
      )}

      {/* Panneau suggestions */}
      {showSuggestions && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h2 className="text-base font-semibold text-amber-800">
                Médicaments en rupture ou sous seuil d'alerte
              </h2>
              {!loadingSugg && (
                <p className="text-xs text-amber-600 mt-0.5">
                  {suggestions.length > 0
                    ? `${suggestions.length} médicament${suggestions.length > 1 ? 's' : ''} à commander`
                    : 'Aucun médicament sous seuil'}
                </p>
              )}
            </div>
            <div className="flex gap-2">
              {suggestions.length > 0 && (
                <button
                  onClick={utiliserSuggestions}
                  className="px-3 py-1.5 bg-amber-600 text-white text-sm rounded-lg hover:bg-amber-700">
                  Utiliser ces suggestions →
                </button>
              )}
              <button onClick={() => setShowSuggestions(false)}
                className="text-amber-600 hover:text-amber-800 text-sm px-2">
                ✕
              </button>
            </div>
          </div>

          {loadingSugg ? (
            <p className="text-sm text-amber-600">Calcul en cours...</p>
          ) : suggestions.length === 0 ? (
            <p className="text-sm text-green-700">✓ Tous les médicaments sont au-dessus de leur seuil minimum.</p>
          ) : (
            <div className="bg-white rounded-lg overflow-hidden border border-amber-200">
              <table className="w-full text-sm">
                <thead className="bg-amber-100 border-b border-amber-200">
                  <tr>
                    <th className="text-left px-4 py-3 text-amber-800 font-medium">Médicament</th>
                    <th className="text-center px-4 py-3 text-amber-800 font-medium">Stock actuel</th>
                    <th className="text-center px-4 py-3 text-amber-800 font-medium">Seuil minimum</th>
                    <th className="text-center px-4 py-3 text-amber-800 font-medium">Qté à commander</th>
                  </tr>
                </thead>
                <tbody>
                  {suggestions.map((s) => (
                    <tr key={s.medicamentId} className="border-b last:border-0">
                      <td className="px-4 py-3 font-medium text-gray-800">{s.nom}</td>
                      <td className={`px-4 py-3 text-center ${couleurStock(s.stockActuel)}`}>{s.stockActuel}</td>
                      <td className="px-4 py-3 text-center text-gray-600">{s.stockMinimum}</td>
                      <td className="px-4 py-3 text-center">
                        <span className="bg-blue-100 text-blue-700 text-xs font-semibold px-2 py-1 rounded-full">
                          {s.quantiteSuggeree}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Formulaire nouvelle commande */}
      {showForm && (
        <div className="bg-white rounded-xl shadow p-6 mb-6">
          <h2 className="font-semibold text-gray-700 mb-4">Nouvelle commande</h2>

          {/* Fournisseur */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Fournisseur *</label>
            <select
              value={fournisseurId}
              onChange={(e) => setFournisseurId(e.target.value)}
              className="w-full max-w-sm px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              <option value="">Choisir un fournisseur</option>
              {fournisseurs.map((f) => (
                <option key={f.id} value={f.id}>{f.nom}</option>
              ))}
            </select>
          </div>

          {/* Date de livraison prevue */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Date de livraison prévue
            </label>
            <input
              type="date"
              value={dateLivraisonPrevue}
              onChange={(e) => setDateLivraisonPrevue(e.target.value)}
              className="w-full max-w-sm px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
            />
            <p className="text-xs text-gray-400 mt-1">
              Suggestion à titre indicatif (+7 jours) — modifiable, ou effaçable si inconnue.
            </p>
          </div>

          {/* Lignes de commande */}
          <div className="mb-4">
            <div className="flex justify-between items-center mb-2">
              <label className="text-sm font-medium text-gray-700">Articles commandés *</label>
              {montantFormulaire > 0 && (
                <span className="text-sm text-gray-500">
                  Total estimé : <span className="font-semibold text-green-600">{formatMontant(montantFormulaire)}</span>
                </span>
              )}
            </div>

            <div className="border border-gray-200 rounded-lg overflow-visible">
              {/* En-têtes */}
              <div className="grid grid-cols-12 gap-2 bg-gray-50 px-4 py-2 text-xs font-medium text-gray-500 border-b rounded-t-lg">
                <div className="col-span-5">Médicament</div>
                <div className="col-span-2 text-center">Quantité</div>
                <div className="col-span-3">Prix unitaire (GNF)</div>
                <div className="col-span-2 text-right">Sous-total</div>
              </div>

              {/* Lignes */}
              {lignes.map((ligne, index) => {
                const q = parseInt(ligne.quantite) || 0
                const p = parseFloat(ligne.prixUnitaire) || 0
                return (
                  <div key={index} className="grid grid-cols-12 gap-2 px-4 py-3 border-b last:border-0 items-center">
                    <div className="col-span-5">
                      <AutocompleteMedicament
                        medicaments={medicaments}
                        valeur={ligne.medicamentId}
                        onChoisir={(id) => onMedicamentChange(index, id)}
                      />
                    </div>
                    <div className="col-span-2">
                      <input
                        type="number"
                        min="1"
                        value={ligne.quantite}
                        onChange={(e) => setLignes(lignes.map((l, i) => i === index ? { ...l, quantite: e.target.value } : l))}
                        className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-green-500"
                      />
                    </div>
                    <div className="col-span-3">
                      <input
                        type="number"
                        min="0"
                        value={ligne.prixUnitaire}
                        onChange={(e) => setLignes(lignes.map((l, i) => i === index ? { ...l, prixUnitaire: e.target.value } : l))}
                        className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                        placeholder="0"
                      />
                    </div>
                    <div className="col-span-1 text-right text-sm font-medium text-gray-700">
                      {q > 0 && p > 0 ? formatMontant(q * p) : '—'}
                    </div>
                    <div className="col-span-1 text-right">
                      <button
                        onClick={() => supprimerLigne(index)}
                        disabled={lignes.length === 1}
                        className="text-red-400 hover:text-red-600 disabled:opacity-30 text-sm">
                        ✕
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>

            <button
              onClick={ajouterLigne}
              className="mt-2 text-sm text-green-600 hover:text-green-800 font-medium">
              + Ajouter une ligne
            </button>
          </div>

          {erreur && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm mb-4">
              {erreur}
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={creerCommande}
              disabled={saving}
              className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium">
              {saving ? 'Création...' : 'Créer la commande'}
            </button>
            <button
              onClick={() => { setShowForm(false); setErreur(null); setLignes([{ medicamentId: '', quantite: '1', prixUnitaire: '' }]) }}
              className="bg-gray-100 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-200">
              Annuler
            </button>
          </div>
        </div>
      )}

      {/* Liste des commandes */}
      <div className="bg-white rounded-xl shadow overflow-hidden">
        {commandes.length === 0 ? (
          <div className="p-8 text-center text-gray-400">Aucune commande</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-6 py-3 text-gray-600">Date</th>
                <th className="text-left px-6 py-3 text-gray-600">Fournisseur</th>
                <th className="text-left px-6 py-3 text-gray-600">Articles</th>
                <th className="text-right px-6 py-3 text-gray-600">Montant</th>
                <th className="text-center px-6 py-3 text-gray-600">Livraison</th>
                <th className="text-center px-6 py-3 text-gray-600">Statut</th>
                <th className="text-center px-6 py-3 text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody>
              {commandes.map((cmd) => (
                <tr
                  key={cmd.id}
                  ref={cmd.id === commandeCibleId ? commandeCibleRef : undefined}
                  className={`border-b last:border-0 hover:bg-gray-50 ${
                    cmd.id === commandeCibleId ? 'bg-amber-50 ring-2 ring-inset ring-amber-300' : ''
                  }`}
                >
                  <td className="px-6 py-4 text-gray-600 whitespace-nowrap">{formatDateTime(cmd.createdAt)}</td>
                  <td className="px-6 py-4 font-medium">{cmd.fournisseur.nom}</td>
                  <td className="px-6 py-4 text-gray-500 text-xs">{cmd.lignes.length} ligne{cmd.lignes.length > 1 ? 's' : ''}</td>
                  <td className="px-6 py-4 text-right">{formatMontant(cmd.montantTotal)}</td>
                  <td className="px-6 py-4 text-center">{badgeLivraison(cmd)}</td>
                  <td className="px-6 py-4 text-center">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${statutCouleur(cmd.statut)}`}>
                      {LABELS_STATUT[cmd.statut] ?? cmd.statut}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className="flex gap-2 justify-center">
                      {cmd.statut === 'BROUILLON' && (
                        <button onClick={() => changerStatut(cmd.id, 'ENVOYEE')}
                          className="text-blue-600 hover:underline text-xs">
                          Envoyer
                        </button>
                      )}
                      {cmd.statut === 'ENVOYEE' && (
                        <button onClick={() => ouvrirReception(cmd)}
                          className="text-green-600 hover:underline text-xs">
                          Réceptionner
                        </button>
                      )}
                      {cmd.statut !== 'ANNULEE' && cmd.statut !== 'RECUE' && (
                        <button onClick={() => changerStatut(cmd.id, 'ANNULEE')}
                          className="text-red-600 hover:underline text-xs">
                          Annuler
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modale de reception reelle : quantite et date de peremption
          saisies ligne par ligne, plus aucune valeur inventee. */}
      <Modal
        open={!!commandeAReceptionner}
        onClose={fermerReception}
        onConfirm={confirmerReception}
        title={`Réceptionner la commande — ${commandeAReceptionner?.fournisseur.nom || ''}`}
        confirmLabel="Confirmer la réception"
        loading={savingReception}
        size="xl"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-500">
            Indiquez la quantité réellement livrée et la date de péremption pour chaque article.
            Si un article n'a pas été livré du tout, laissez la quantité à 0.
          </p>

          {lignesReception.map((l, index) => {
            const total = totalRecuLigne(l)
            return (
              <div key={l.ligneId} className="border border-gray-200 rounded-lg p-3">
                <p className="text-sm font-medium text-gray-800 mb-2">
                  {l.nom} <span className="text-gray-400 font-normal">(commandé : {l.quantiteCommandee})</span>
                </p>

                <div className="space-y-2">
                  {l.sousLots.map((sl, sousIndex) => (
                    <div key={sousIndex} className="flex gap-3 items-start">
                      <div className="flex-1">
                        <label className="block text-xs text-gray-500 mb-1">
                          {sousIndex === 0 ? 'Quantité reçue' : `Quantité (lot ${sousIndex + 1})`}
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={sl.quantite}
                          onChange={(e) => modifierSousLot(index, sousIndex, 'quantite', e.target.value)}
                          className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                        />
                      </div>
                      <div className="flex-1">
                        <label className="block text-xs text-gray-500 mb-1">Date de péremption</label>
                        <input
                          type="date"
                          value={sl.datePeremption}
                          onChange={(e) => modifierSousLot(index, sousIndex, 'datePeremption', e.target.value)}
                          className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                        />
                        {estPeremptionProche(sl.datePeremption) && (
                          <p className="text-xs text-amber-600 mt-1">
                            ⚠ Péremption dans moins de 3 mois
                          </p>
                        )}
                      </div>
                      <div className="flex-1">
                        <label className="block text-xs text-gray-500 mb-1">N° de lot (optionnel)</label>
                        <input
                          type="text"
                          value={sl.numeroLot}
                          onChange={(e) => modifierSousLot(index, sousIndex, 'numeroLot', e.target.value)}
                          placeholder="Ex: LOT-2026-04"
                          className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                        />
                      </div>
                      {l.sousLots.length > 1 && (
                        <button
                          onClick={() => supprimerSousLot(index, sousIndex)}
                          className="text-red-400 hover:text-red-600 text-sm mt-5"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => ajouterSousLot(index)}
                  className="mt-2 text-xs text-green-600 hover:text-green-800 font-medium"
                >
                  + Ajouter un lot avec une autre date de péremption
                </button>

                {total < l.quantiteCommandee && (
                  <p className="text-xs text-orange-500 mt-1">
                    ⚠ Écart : {l.quantiteCommandee - total} unité(s) manquante(s)
                  </p>
                )}
                {total > l.quantiteCommandee && (
                  <p className="text-xs text-blue-500 mt-1">
                    ⚠ Écart : {total - l.quantiteCommandee} unité(s) reçue(s) en plus de la commande
                  </p>
                )}
              </div>
            )
          })}

          {erreurReception && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {erreurReception}
            </div>
          )}
        </div>
      </Modal>
    </div>
  )
}

export default function CommandesPage() {
  return (
    <Suspense fallback={<div className="p-8 text-gray-400">Chargement...</div>}>
      <CommandesPageInner />
    </Suspense>
  )
}