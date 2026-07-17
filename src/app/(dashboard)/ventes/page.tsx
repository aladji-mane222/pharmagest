// CIBLE: src/app/(dashboard)/ventes/page.tsx
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { formatMontant } from '@/lib/utils'
import { useToast } from '@/components/ui'

interface Medicament {
  id: string
  nom: string
  prixVente: number
  stockTotal: number
  unite: string
}

interface LignePanier {
  medicamentId: string
  nom: string
  prixUnitaire: number
  quantite: number
  stockTotal: number
}

export default function VentesPage() {
  const { showToast } = useToast()
  const [medicaments, setMedicaments] = useState<Medicament[]>([])
  const [search, setSearch] = useState('')
  const [panier, setPanier] = useState<LignePanier[]>([])
  const [paiements, setPaiements] = useState<{ id: string; modePaiement: string; montant: string }[]>([
    { id: 'p0', modePaiement: 'ESPECES', montant: '' },
  ])
  const [saving, setSaving] = useState(false)
  const [recu, setRecu] = useState<{
    montantTotal: number
    monnaie: number
    paiements: { modePaiement: string; montant: number }[]
    resteADu: number
    clientNom: string | null
    lignes: LignePanier[]
    numero: string
    remise: number
  } | null>(null)
  const [clients, setClients] = useState<{ id: string; nom: string }[]>([])
  const [clientId, setClientId] = useState('')
  const [nouveauClientOuvert, setNouveauClientOuvert] = useState(false)
  const [nouveauClientForm, setNouveauClientForm] = useState({ nom: '', telephone: '' })
  const [nouveauClientSaving, setNouveauClientSaving] = useState(false)
  const [remise, setRemise] = useState(0)
  const [nomPharmacie, setNomPharmacie] = useState('Ma Pharmacie')
  const [formatRecu, setFormatRecu] = useState<'A4' | 'THERMIQUE_58' | 'THERMIQUE_80'>('A4')
  const [sessionCaisse, setSessionCaisse] = useState<boolean | null>(null)

  const chargerClients = () => {
    fetch('/api/clients')
      .then((r) => r.json())
      .then((json) => setClients(json.data || []))
  }

  const creerClientRapide = async () => {
    if (!nouveauClientForm.nom.trim()) {
      showToast('Le nom est requis', 'error')
      return
    }
    setNouveauClientSaving(true)
    try {
      const res = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nom: nouveauClientForm.nom, telephone: nouveauClientForm.telephone || null }),
      })
      const json = await res.json()
      if (!res.ok) {
        showToast(json.error || 'Erreur lors de la creation du client', 'error')
        return
      }
      // Le nouveau client est directement selectionne pour cette vente —
      // pas besoin de revenir chercher dans la liste apres l'avoir cree.
      chargerClients()
      setClientId(json.data.id)
      setNouveauClientForm({ nom: '', telephone: '' })
      setNouveauClientOuvert(false)
      showToast('Client cree et selectionne', 'success')
    } catch {
      showToast('Erreur reseau', 'error')
    } finally {
      setNouveauClientSaving(false)
    }
  }

  useEffect(() => {
    chargerClients()

    fetch('/api/parametres')
      .then((r) => r.json())
      .then((json) => {
        const nom = json.data?.nom ?? json.data?.pharmacie?.nom
        if (nom) setNomPharmacie(nom)
        const format = json.data?.formatRecu ?? json.data?.pharmacie?.formatRecu
        if (format) setFormatRecu(format)
      })
      .catch(() => {})

    fetch('/api/caisse')
      .then((r) => r.json())
      .then((json) => setSessionCaisse(!!json.data?.sessionActive))
      .catch(() => setSessionCaisse(false))
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => {
      if (search.length >= 2) {
        fetch(`/api/medicaments?search=${search}`)
          .then((res) => res.json())
          .then((json) => setMedicaments(json.data?.medicaments || []))
      } else {
        setMedicaments([])
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [search])

  const ajouterAuPanier = (med: Medicament) => {
    if (med.stockTotal === 0) return
    const existant = panier.find((l) => l.medicamentId === med.id)
    if (existant) {
      if (existant.quantite >= existant.stockTotal) return
      setPanier(panier.map((l) => l.medicamentId === med.id ? { ...l, quantite: l.quantite + 1 } : l))
    } else {
      setPanier([...panier, { medicamentId: med.id, nom: med.nom, prixUnitaire: med.prixVente, quantite: 1, stockTotal: med.stockTotal }])
    }
    setSearch('')
    setMedicaments([])
  }

  const modifierQuantite = (medicamentId: string, quantite: number) => {
    if (quantite <= 0) {
      setPanier(panier.filter((l) => l.medicamentId !== medicamentId))
    } else {
      setPanier(panier.map((l) => l.medicamentId === medicamentId ? { ...l, quantite } : l))
    }
  }

  const montantTotal = panier.reduce((sum, l) => sum + l.prixUnitaire * l.quantite, 0)
  const totalNet = Math.max(0, montantTotal - remise)

  const ajouterLignePaiement = () => {
    setPaiements([...paiements, { id: `p${Date.now()}`, modePaiement: 'ESPECES', montant: '' }])
  }
  const retirerLignePaiement = (id: string) => {
    setPaiements(paiements.filter((p) => p.id !== id))
  }
  const modifierLignePaiement = (id: string, champ: 'modePaiement' | 'montant', valeur: string) => {
    setPaiements(paiements.map((p) => (p.id === id ? { ...p, [champ]: valeur } : p)))
  }

  const totalPaiements = paiements.reduce((sum, p) => sum + (parseFloat(p.montant) || 0), 0)
  const montantNonEspeces = paiements
    .filter((p) => p.modePaiement !== 'ESPECES')
    .reduce((sum, p) => sum + (parseFloat(p.montant) || 0), 0)
  // Un trop-percu ne peut etre rendu qu'en especes — meme calcul que le
  // backend, affiche ici pour que le caissier voie l'erreur avant de valider.
  const nonEspecesDepasseLeTotal = montantNonEspeces > totalNet
  const monnaie = Math.max(0, totalPaiements - totalNet)
  const resteADu = Math.max(0, totalNet - totalPaiements)

  const validerVente = async () => {
    if (panier.length === 0) { showToast('Panier vide', 'error'); return }
    if (nonEspecesDepasseLeTotal) {
      showToast('Le montant paye en mobile money/carte depasse le total — un trop-percu ne peut etre rendu qu\'en especes', 'error')
      return
    }
    if (resteADu > 0 && !clientId) {
      showToast(`Il reste ${formatMontant(resteADu)} non couvert — selectionne un client pour le mettre sur son compte credit`, 'error')
      return
    }
    setSaving(true)

    const lignesPaiementValides = paiements
      .filter((p) => parseFloat(p.montant) > 0)
      .map((p) => ({ modePaiement: p.modePaiement, montant: parseFloat(p.montant) }))

    try {
      const res = await fetch('/api/ventes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lignes: panier.map((l) => ({ medicamentId: l.medicamentId, quantite: l.quantite })),
          paiements: lignesPaiementValides,
          clientId: clientId || null,
          remise,
        }),
      })

      let json: { error?: string; data?: { numeroFacture?: string } } = {}
      try {
        json = await res.json()
      } catch {
        // Reponse vide ou non-JSON (panne reseau/base en cours de requete) —
        // on traite comme un echec generique plutot que de laisser planter
        // la page (constate en usage reel le 11/07/2026 : la page restait
        // bloquee indefiniment sur ce cas).
      }

      if (res.ok) {
        // Utilise le vrai numero de facture genere par le serveur — pas un
        // horodatage local (etait le cas avant le 13/07/2026, ce qui
        // n'avait aucun rapport avec le vrai numeroFacture stocke en base).
        const numero = json.data?.numeroFacture || `REC-${Date.now()}`
        setRecu({
          montantTotal: totalNet,
          monnaie,
          paiements: lignesPaiementValides,
          resteADu,
          clientNom: clients.find((c) => c.id === clientId)?.nom || null,
          lignes: [...panier],
          numero,
          remise,
        })
        setPanier([])
        setPaiements([{ id: 'p0', modePaiement: 'ESPECES', montant: '' }])
        setClientId('')
        setRemise(0)
      } else {
        showToast(json.error || 'Erreur lors de la vente — reessaie dans quelques secondes', 'error')
      }
    } catch {
      showToast('Erreur reseau — la vente n\'a peut-etre pas ete enregistree, verifie l\'historique avant de reessayer', 'error')
    } finally {
      setSaving(false)
    }
  }

  const libelleModePaiement = (mode: string) => {
    const libelles: Record<string, string> = {
      ESPECES: 'Especes',
      MOBILE_MONEY: 'Mobile Money',
      ORANGE_MONEY: 'Orange Money',
      MTN_MONEY: 'MTN Money',
      PAIEMENT_MARCHAND: 'Paiement Marchand',
      CARTE: 'Carte',
    }
    return libelles[mode] || mode
  }

  const stockCouleur = (stock: number) => {
    if (stock === 0) return 'text-red-500'
    if (stock <= 10) return 'text-orange-500'
    return 'text-green-600'
  }

  const stockLabel = (stock: number) => {
    if (stock === 0) return 'Rupture'
    return `Stock: ${stock}`
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-gray-800 mb-4">Point de Vente</h1>

      {sessionCaisse === false && (
        <div className="mb-5 bg-red-50 border border-red-200 rounded-lg px-4 py-3 flex items-center justify-between">
          <span className="text-red-700 font-medium text-sm">⚠️ Aucune session caisse ouverte — les ventes ne peuvent pas être enregistrées</span>
          <Link href="/caisse" className="text-sm font-medium text-red-600 underline hover:text-red-800">
            Ouvrir la caisse →
          </Link>
        </div>
      )}

      {recu && (
        <>
          <style jsx global>{`
            @media print {
              body * { visibility: hidden; }
              .recu-print, .recu-print * { visibility: visible; }
              .no-print { display: none !important; }
              .recu-print {
                position: fixed;
                top: 0; left: 0;
                ${formatRecu === 'A4'
                  ? 'width: 100%; padding: 20px;'
                  : formatRecu === 'THERMIQUE_58'
                  ? 'width: 48mm; padding: 4px; font-size: 10px; line-height: 1.3;'
                  : 'width: 72mm; padding: 6px; font-size: 11px; line-height: 1.3;'}
              }
              ${formatRecu !== 'A4'
                ? `@page { size: ${formatRecu === 'THERMIQUE_58' ? '58mm' : '80mm'} auto; margin: 0; }`
                : ''}
            }
          `}</style>
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-8 max-w-md w-full">
              <div className="recu-print">
                <div className="text-center mb-4">
                  <p className="font-bold text-lg text-gray-900">{nomPharmacie}</p>
                  <div className="text-3xl my-2">✅</div>
                  <h2 className="text-xl font-bold text-gray-800">Vente enregistree !</h2>
                  <p className="text-xs text-gray-400 mt-1">Recu {recu.numero}</p>
                  <p className="text-xs text-gray-400">{new Date().toLocaleString('fr-FR')}</p>
                </div>
                {/* Liste empilee plutot qu'un tableau a colonnes fixes : une structure
                    unique qui tient aussi bien sur A4 que sur une bande thermique de
                    48mm, sans risque de colonnes coupees ou de texte qui deborde. */}
                <div className="border-t pt-2 mb-2 space-y-2">
                  {recu.lignes.map((l) => (
                    <div key={l.medicamentId}>
                      <p className="leading-snug">{l.nom}</p>
                      <div className="flex justify-between text-gray-500">
                        <span>{l.quantite} x {formatMontant(l.prixUnitaire)}</span>
                        <span className="font-medium text-gray-800">
                          {formatMontant(l.prixUnitaire * l.quantite)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="space-y-1 text-sm border-t pt-2">
                  {recu.remise > 0 && (
                    <div className="flex justify-between text-orange-500">
                      <span>Remise</span>
                      <span>-{formatMontant(recu.remise)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-green-600">
                    <span>Total</span>
                    <span>{formatMontant(recu.montantTotal)}</span>
                  </div>
                  {recu.paiements.map((p, i) => (
                    <div key={i} className="flex justify-between text-gray-600">
                      <span>{libelleModePaiement(p.modePaiement)}</span>
                      <span>{formatMontant(p.montant)}</span>
                    </div>
                  ))}
                  {recu.monnaie > 0 && (
                    <div className="flex justify-between text-gray-600">
                      <span>Monnaie</span>
                      <span>{formatMontant(recu.monnaie)}</span>
                    </div>
                  )}
                  {recu.resteADu > 0 && (
                    <div className="flex justify-between text-red-600 font-medium">
                      <span>Reste a payer (credit{recu.clientNom ? ` — ${recu.clientNom}` : ''})</span>
                      <span>{formatMontant(recu.resteADu)}</span>
                    </div>
                  )}
                </div>
                <p className="text-center text-xs text-gray-400 mt-4">Merci de votre confiance !</p>
              </div>
              <div className="mt-6 space-y-3 no-print">
                <button
                  onClick={() => window.print()}
                  className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 w-full">
                  🖨️ Imprimer le recu
                </button>
                <button
                  onClick={() => {
                    const numero = prompt('Entrez le numéro WhatsApp du client (ex: 224620000000) :')
                    if (!numero) return

                    const lignesTexte = recu?.lignes?.map(l =>
                      `- ${l.nom} x${l.quantite} = ${(l.prixUnitaire * l.quantite).toLocaleString()} GNF`
                    ).join('%0A') || ''

                    const paiementsTexte = recu?.paiements?.map(p =>
                      `${libelleModePaiement(p.modePaiement)}: ${p.montant.toLocaleString()} GNF`
                    ).join('%0A') || ''

                    const clientTexte = recu?.clientNom ? `%0AClient: ${recu.clientNom}` : ''
                    const monnaieTexte = (recu?.monnaie ?? 0) > 0
                      ? `%0AMonnaie: ${recu!.monnaie.toLocaleString()} GNF`
                      : ''
                    const creditTexte = (recu?.resteADu ?? 0) > 0
                      ? `%0AReste a payer (credit): ${recu!.resteADu.toLocaleString()} GNF`
                      : ''

                    const message = `*RECU - ${nomPharmacie}*%0A%0ARecu: ${recu?.numero || ''}%0ADate: ${new Date().toLocaleString('fr-FR')}${clientTexte}%0A%0A*Articles:*%0A${lignesTexte}%0A%0A*Total: ${recu?.montantTotal?.toLocaleString()} GNF*%0A${paiementsTexte}${monnaieTexte}${creditTexte}%0A%0AMerci de votre confiance!`

                    window.open(`https://wa.me/${numero}?text=${message}`, '_blank')
                  }}
                  className="bg-green-500 text-white px-6 py-2 rounded-lg hover:bg-green-600 w-full">
                  📱 Envoyer par WhatsApp
                </button>
                <button onClick={() => setRecu(null)}
                  className="bg-gray-100 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-200 w-full">
                  Nouvelle vente
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 space-y-4">
          <div className="relative">
            <input type="text" placeholder="Rechercher un medicament (min 2 lettres)..."
              value={search} onChange={(e) => setSearch(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-lg" />
            {medicaments.length > 0 && (
              <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg z-10 mt-1">
                {medicaments.map((med) => (
                  <button
                    key={med.id}
                    onClick={() => ajouterAuPanier(med)}
                    disabled={med.stockTotal === 0}
                    className="w-full text-left px-4 py-3 hover:bg-green-50 border-b last:border-0 flex justify-between items-center disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    <span className="font-medium">{med.nom}</span>
                    <div className="flex items-center gap-3">
                      <span className={`text-xs font-semibold ${stockCouleur(med.stockTotal)}`}>
                        {stockLabel(med.stockTotal)}
                      </span>
                      <span className="text-green-600">{formatMontant(med.prixVente)}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl shadow overflow-hidden">
            {panier.length === 0 ? (
              <div className="p-12 text-center text-gray-400">
                <p className="text-4xl mb-2">🛒</p>
                <p>Recherchez un medicament pour commencer</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left px-4 py-3 text-gray-600">Medicament</th>
                    <th className="text-center px-4 py-3 text-gray-600">Quantite</th>
                    <th className="text-right px-4 py-3 text-gray-600">Prix unit.</th>
                    <th className="text-right px-4 py-3 text-gray-600">Total</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {panier.map((ligne) => (
                    <tr key={ligne.medicamentId} className="border-b last:border-0">
                      <td className="px-4 py-3 font-medium">{ligne.nom}</td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex flex-col items-center gap-0.5">
                          <input
                            type="number"
                            min={1}
                            max={ligne.stockTotal}
                            value={ligne.quantite}
                            onWheel={(e) => (e.target as HTMLInputElement).blur()}
                            onChange={(e) => {
                              const valeur = parseInt(e.target.value, 10)
                              if (Number.isNaN(valeur)) return
                              modifierQuantite(
                                ligne.medicamentId,
                                Math.min(Math.max(valeur, 0), ligne.stockTotal)
                              )
                            }}
                            className="w-16 text-center px-2 py-1 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                          />
                          <span className="text-xs text-gray-400">/ {ligne.stockTotal} dispo</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right text-gray-600">{formatMontant(ligne.prixUnitaire)}</td>
                      <td className="px-4 py-3 text-right font-medium">{formatMontant(ligne.prixUnitaire * ligne.quantite)}</td>
                      <td className="px-4 py-3 text-center">
                        <button onClick={() => modifierQuantite(ligne.medicamentId, 0)}
                          className="text-red-400 hover:text-red-600">✕</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow p-6 space-y-4 h-fit">
          <h2 className="font-semibold text-gray-700 text-lg">Paiement</h2>

          <div className="border-t pt-4">
            {remise > 0 && (
              <div className="flex justify-between text-sm text-gray-400 mb-1">
                <span>Sous-total</span>
                <span>{formatMontant(montantTotal)}</span>
              </div>
            )}
            {remise > 0 && (
              <div className="flex justify-between text-sm text-orange-500 mb-1">
                <span>Remise</span>
                <span>-{formatMontant(remise)}</span>
              </div>
            )}
            <div className="flex justify-between text-lg font-bold mb-4">
              <span>Total</span>
              <span className="text-green-600">{formatMontant(totalNet)}</span>
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="block text-sm font-medium text-gray-700">Client (optionnel)</label>
              <button
                type="button"
                onClick={() => setNouveauClientOuvert(true)}
                className="text-xs text-green-600 hover:underline"
              >
                + Nouveau
              </button>
            </div>
            <select value={clientId} onChange={(e) => setClientId(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500">
              <option value="">Client anonyme</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.nom}</option>
              ))}
            </select>
          </div>

          {nouveauClientOuvert && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-black bg-opacity-40" onClick={() => !nouveauClientSaving && setNouveauClientOuvert(false)} />
              <div className="relative bg-white rounded-xl shadow-lg w-full max-w-sm p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Nouveau client rapide</h3>
                <div className="space-y-3 mb-4">
                  <input
                    type="text"
                    placeholder="Nom *"
                    autoFocus
                    value={nouveauClientForm.nom}
                    onChange={(e) => setNouveauClientForm({ ...nouveauClientForm, nom: e.target.value })}
                    onKeyDown={(e) => e.key === 'Enter' && creerClientRapide()}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                  <input
                    type="text"
                    placeholder="Telephone (optionnel)"
                    value={nouveauClientForm.telephone}
                    onChange={(e) => setNouveauClientForm({ ...nouveauClientForm, telephone: e.target.value })}
                    onKeyDown={(e) => e.key === 'Enter' && creerClientRapide()}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setNouveauClientOuvert(false)}
                    className="px-4 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={creerClientRapide}
                    disabled={nouveauClientSaving}
                    className="px-4 py-2 rounded-lg text-sm bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
                  >
                    {nouveauClientSaving ? 'Creation...' : 'Creer et selectionner'}
                  </button>
                </div>
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Paiement</label>
            <div className="space-y-2">
              {paiements.map((p) => (
                <div key={p.id} className="flex gap-2">
                  <select
                    value={p.modePaiement}
                    onChange={(e) => modifierLignePaiement(p.id, 'modePaiement', e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
                  >
                    <option value="ESPECES">Especes</option>
                    <option value="MOBILE_MONEY">Mobile Money</option>
                    <option value="ORANGE_MONEY">Orange Money</option>
                    <option value="MTN_MONEY">MTN Money</option>
                    <option value="PAIEMENT_MARCHAND">Paiement Marchand</option>
                    <option value="CARTE">Carte</option>
                  </select>
                  <input
                    type="number"
                    value={p.montant}
                    onChange={(e) => modifierLignePaiement(p.id, 'montant', e.target.value)}
                    onWheel={(e) => (e.target as HTMLInputElement).blur()}
                    placeholder="0"
                    className="w-32 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
                  />
                  {paiements.length > 1 && (
                    <button
                      onClick={() => retirerLignePaiement(p.id)}
                      className="text-red-400 hover:text-red-600 px-1"
                      title="Retirer ce mode de paiement"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button
              onClick={ajouterLignePaiement}
              className="text-sm text-green-600 hover:text-green-700 font-medium mt-2"
            >
              + Ajouter un mode de paiement
            </button>
            <p className="text-xs text-gray-400 mt-2">
              Rien saisi ou pas assez ? Le reste sera mis sur le compte credit du client
              selectionne. Laissez tout vide pour une vente entierement a credit.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Remise (GNF)</label>
            <input
              type="number"
              min={0}
              max={montantTotal}
              value={remise || ''}
              onChange={(e) => setRemise(Math.max(0, Math.min(Number(e.target.value), montantTotal)))}
              onWheel={(e) => (e.target as HTMLInputElement).blur()}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              placeholder="0"
            />
          </div>

          {nonEspecesDepasseLeTotal && (
            <div className="bg-red-50 text-red-600 text-sm rounded-lg p-3">
              Le mobile money/carte saisi depasse le total — un trop-percu ne peut etre
              rendu qu&apos;en especes, corrigez les montants.
            </div>
          )}

          {!nonEspecesDepasseLeTotal && monnaie > 0 && (
            <div className="bg-green-50 rounded-lg p-3 text-center">
              <p className="text-sm text-gray-500">Monnaie a rendre</p>
              <p className="text-2xl font-bold text-green-600">{formatMontant(monnaie)}</p>
            </div>
          )}

          {!nonEspecesDepasseLeTotal && resteADu > 0 && (
            <div className={`rounded-lg p-3 text-center ${clientId ? 'bg-orange-50' : 'bg-red-50'}`}>
              <p className="text-sm text-gray-500">
                Reste a mettre en credit {clientId ? '' : '— selectionnez un client ci-dessus'}
              </p>
              <p className={`text-2xl font-bold ${clientId ? 'text-orange-600' : 'text-red-600'}`}>
                {formatMontant(resteADu)}
              </p>
            </div>
          )}

          <button
            onClick={validerVente}
            disabled={saving || panier.length === 0 || sessionCaisse === false}
            className="w-full bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium text-lg disabled:cursor-not-allowed"
          >
            {saving ? 'Enregistrement...' : sessionCaisse === false ? 'Session caisse requise' : 'Valider la vente'}
          </button>
        </div>
      </div>
    </div>
  )
}