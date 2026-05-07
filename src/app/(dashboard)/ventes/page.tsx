'use client'

import { useEffect, useState } from 'react'
import { formatMontant } from '@/lib/utils'

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
}

export default function VentesPage() {
  const [medicaments, setMedicaments] = useState<Medicament[]>([])
  const [search, setSearch] = useState('')
  const [panier, setPanier] = useState<LignePanier[]>([])
  const [modePaiement, setModePaiement] = useState('ESPECES')
  const [montantPaye, setMontantPaye] = useState('')
  const [saving, setSaving] = useState(false)
  const [recu, setRecu] = useState<{ montantTotal: number; monnaie: number } | null>(null)

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
    const existant = panier.find((l) => l.medicamentId === med.id)
    if (existant) {
      setPanier(panier.map((l) => l.medicamentId === med.id ? { ...l, quantite: l.quantite + 1 } : l))
    } else {
      setPanier([...panier, { medicamentId: med.id, nom: med.nom, prixUnitaire: med.prixVente, quantite: 1 }])
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
  const montantPayeFloat = parseFloat(montantPaye) || 0
  const monnaie = Math.max(0, montantPayeFloat - montantTotal)

  const validerVente = async () => {
    if (panier.length === 0) return alert('Panier vide')
    if (!montantPaye) return alert('Entrer le montant paye')
    setSaving(true)

    const res = await fetch('/api/ventes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lignes: panier.map((l) => ({ medicamentId: l.medicamentId, quantite: l.quantite })),
        modePaiement,
        montantPaye,
      }),
    })

    const json = await res.json()
    if (res.ok) {
      setRecu({ montantTotal, monnaie })
      setPanier([])
      setMontantPaye('')
    } else {
      alert(json.error)
    }
    setSaving(false)
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Point de Vente</h1>

      {recu && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-8 max-w-sm w-full text-center">
            <div className="text-5xl mb-4">✅</div>
            <h2 className="text-xl font-bold text-gray-800 mb-2">Vente enregistree !</h2>
            <p className="text-gray-600 mb-1">Total : <span className="font-bold">{formatMontant(recu.montantTotal)}</span></p>
            <p className="text-green-600 font-bold text-lg mb-6">Monnaie : {formatMontant(recu.monnaie)}</p>
            <button onClick={() => setRecu(null)}
              className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 w-full">
              Nouvelle vente
            </button>
          </div>
        </div>
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
                  <button key={med.id} onClick={() => ajouterAuPanier(med)}
                    className="w-full text-left px-4 py-3 hover:bg-green-50 border-b last:border-0 flex justify-between">
                    <span className="font-medium">{med.nom}</span>
                    <span className="text-green-600">{formatMontant(med.prixVente)}</span>
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
                        <div className="flex items-center justify-center gap-2">
                          <button onClick={() => modifierQuantite(ligne.medicamentId, ligne.quantite - 1)}
                            className="w-7 h-7 bg-gray-100 rounded-full hover:bg-gray-200 font-bold">-</button>
                          <span className="w-8 text-center">{ligne.quantite}</span>
                          <button onClick={() => modifierQuantite(ligne.medicamentId, ligne.quantite + 1)}
                            className="w-7 h-7 bg-gray-100 rounded-full hover:bg-gray-200 font-bold">+</button>
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
            <div className="flex justify-between text-lg font-bold mb-4">
              <span>Total</span>
              <span className="text-green-600">{formatMontant(montantTotal)}</span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Mode de paiement</label>
            <select value={modePaiement} onChange={(e) => setModePaiement(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500">
              <option value="ESPECES">Especes</option>
              <option value="MOBILE_MONEY">Mobile Money</option>
              <option value="CARTE">Carte</option>
              <option value="CREDIT">Credit</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Montant recu (GNF)</label>
            <input type="number" value={montantPaye} onChange={(e) => setMontantPaye(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-lg"
              placeholder="0" />
          </div>

          {montantPayeFloat > 0 && (
            <div className="bg-green-50 rounded-lg p-3 text-center">
              <p className="text-sm text-gray-500">Monnaie a rendre</p>
              <p className="text-2xl font-bold text-green-600">{formatMontant(monnaie)}</p>
            </div>
          )}

          <button onClick={validerVente} disabled={saving || panier.length === 0}
            className="w-full bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium text-lg">
            {saving ? 'Enregistrement...' : 'Valider la vente'}
          </button>
        </div>
      </div>
    </div>
  )
}
