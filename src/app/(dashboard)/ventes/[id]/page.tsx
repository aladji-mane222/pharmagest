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
  stockDisponible: number
}

export default function VentesPage() {
  const [medicaments,    setMedicaments]    = useState<Medicament[]>([])
  const [search,         setSearch]         = useState('')
  const [panier,         setPanier]         = useState<LignePanier[]>([])
  const [modePaiement,   setModePaiement]   = useState('ESPECES')
  const [montantPaye,    setMontantPaye]    = useState('')
  const [saving,         setSaving]         = useState(false)
  const [clients,        setClients]        = useState<{ id: string; nom: string }[]>([])
  const [clientId,       setClientId]       = useState('')
  const [remise,         setRemise]         = useState(0)
  const [nomPharmacie,   setNomPharmacie]   = useState('Ma Pharmacie')
  const [sessionOuverte, setSessionOuverte] = useState<boolean | null>(null) // null = chargement
  const [recu, setRecu] = useState<{
    montantTotal: number
    monnaie: number
    montantPaye: number
    lignes: LignePanier[]
    numero: string
    remise: number
    modePaiement: string
  } | null>(null)

  // Chargement initial : clients + session caisse + nom pharmacie
  useEffect(() => {
    Promise.all([
      fetch('/api/clients').then((r) => r.json()),
      fetch('/api/caisse').then((r) => r.json()),
      fetch('/api/parametres').then((r) => r.json()),
    ]).then(([clientsJson, caisseJson, parametresJson]) => {
      setClients(clientsJson.data || [])
      setSessionOuverte(!!caisseJson.data?.sessionActive)
      const nom = parametresJson.data?.nom ?? parametresJson.data?.pharmacie?.nom
      if (nom) setNomPharmacie(nom)
    })
  }, [])

  // Recherche médicaments avec debounce
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
    if (med.stockTotal <= 0) return // bloqué si rupture

    const existant = panier.find((l) => l.medicamentId === med.id)
    if (existant) {
      // Ne pas dépasser le stock disponible
      if (existant.quantite >= existant.stockDisponible) return
      setPanier(panier.map((l) =>
        l.medicamentId === med.id ? { ...l, quantite: l.quantite + 1 } : l
      ))
    } else {
      setPanier([...panier, {
        medicamentId:    med.id,
        nom:             med.nom,
        prixUnitaire:    med.prixVente,
        quantite:        1,
        stockDisponible: med.stockTotal,
      }])
    }
    setSearch('')
    setMedicaments([])
  }

  const modifierQuantite = (medicamentId: string, quantite: number) => {
    if (quantite <= 0) {
      setPanier(panier.filter((l) => l.medicamentId !== medicamentId))
    } else {
      const ligne = panier.find((l) => l.medicamentId === medicamentId)
      if (ligne && quantite > ligne.stockDisponible) return // bloqué si dépasse le stock
      setPanier(panier.map((l) =>
        l.medicamentId === medicamentId ? { ...l, quantite } : l
      ))
    }
  }

  const montantTotal  = panier.reduce((sum, l) => sum + l.prixUnitaire * l.quantite, 0)
  const totalNet      = Math.max(0, montantTotal - remise)
  const montantPayeFloat = parseFloat(montantPaye) || 0
  const monnaie       = Math.max(0, montantPayeFloat - totalNet)

  const validerVente = async () => {
    if (panier.length === 0) return alert('Panier vide')
    if (modePaiement !== 'CREDIT' && !montantPaye) return alert('Entrer le montant payé')
    setSaving(true)

    const montantPayeEffectif = modePaiement === 'CREDIT' ? '0' : montantPaye

    const res = await fetch('/api/ventes', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        lignes:       panier.map((l) => ({ medicamentId: l.medicamentId, quantite: l.quantite })),
        modePaiement,
        montantPaye:  montantPayeEffectif,
        clientId:     clientId || null,
        remise,
      }),
    })

    const json = await res.json()
    if (res.ok) {
      setRecu({
        montantTotal: totalNet,
        monnaie:      modePaiement === 'CREDIT' ? 0 : monnaie,
        montantPaye:  parseFloat(montantPayeEffectif) || 0,
        lignes:       [...panier],
        numero:       `REC-${Date.now()}`,
        remise,
        modePaiement,
      })
      setPanier([])
      setMontantPaye('')
      setClientId('')
      setRemise(0)
    } else {
      alert(json.error)
    }
    setSaving(false)
  }

  // Bouton valider désactivé si pas de session caisse ouverte
  const peutVendre = sessionOuverte === true && panier.length > 0

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Point de Vente</h1>
        {sessionOuverte === false && (
          <div className="flex items-center gap-2 px-4 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
            <span className="w-2 h-2 rounded-full bg-red-500"></span>
            Aucune session caisse ouverte —{' '}
            <a href="/caisse" className="underline font-medium">Ouvrir la caisse</a>
          </div>
        )}
        {sessionOuverte === true && (
          <div className="flex items-center gap-2 px-4 py-2 bg-green-50 border border-green-200 rounded-lg text-sm text-green-600">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
            Session caisse ouverte
          </div>
        )}
      </div>

      {/* Modal reçu */}
      {recu && (
        <>
          <style jsx global>{`
            @media print {
              body * { visibility: hidden; }
              .recu-print, .recu-print * { visibility: visible; }
              .recu-print { position: fixed; top: 0; left: 0; width: 100%; padding: 20px; }
              .no-print { display: none !important; }
            }
          `}</style>
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-8 max-w-md w-full">
              <div className="recu-print">
                <div className="text-center mb-4">
                  <p className="font-bold text-lg text-gray-900">{nomPharmacie}</p>
                  <div className="text-3xl my-2">✅</div>
                  <h2 className="text-xl font-bold text-gray-800">Vente enregistrée !</h2>
                  <p className="text-xs text-gray-400 mt-1">Reçu {recu.numero}</p>
                  <p className="text-xs text-gray-400">{new Date().toLocaleString('fr-FR')}</p>
                </div>
                <table className="w-full text-sm mb-4 border-t pt-2">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-1 text-gray-500">Article</th>
                      <th className="text-center py-1 text-gray-500">Qté</th>
                      <th className="text-right py-1 text-gray-500">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recu.lignes.map((l) => (
                      <tr key={l.medicamentId} className="border-b">
                        <td className="py-1">{l.nom}</td>
                        <td className="py-1 text-center">{l.quantite}</td>
                        <td className="py-1 text-right">{formatMontant(l.prixUnitaire * l.quantite)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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
                  {recu.modePaiement !== 'CREDIT' && (
                    <>
                      <div className="flex justify-between text-gray-600">
                        <span>Montant reçu</span>
                        <span>{formatMontant(recu.montantPaye)}</span>
                      </div>
                      <div className="flex justify-between text-gray-600">
                        <span>Monnaie</span>
                        <span>{formatMontant(recu.monnaie)}</span>
                      </div>
                    </>
                  )}
                  {recu.modePaiement === 'CREDIT' && (
                    <div className="flex justify-between text-red-600 font-medium">
                      <span>Montant dû (crédit)</span>
                      <span>{formatMontant(recu.montantTotal)}</span>
                    </div>
                  )}
                </div>
                <p className="text-center text-xs text-gray-400 mt-4">Merci de votre confiance !</p>
              </div>
              <div className="mt-6 space-y-3 no-print">
                <button onClick={() => window.print()}
                  className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 w-full">
                  🖨️ Imprimer le reçu
                </button>
                <button
                  onClick={() => {
                    const numero = prompt('Numéro WhatsApp du client (ex: 224620000000) :')
                    if (!numero) return
                    const lignesTexte = recu.lignes.map((l) =>
                      `- ${l.nom} x${l.quantite} = ${(l.prixUnitaire * l.quantite).toLocaleString()} GNF`
                    ).join('%0A')
                    const message = `*REÇU - ${nomPharmacie}*%0A%0AReçu: ${recu.numero}%0ADate: ${new Date().toLocaleString('fr-FR')}%0A%0A*Articles:*%0A${lignesTexte}%0A%0A*Total: ${recu.montantTotal.toLocaleString()} GNF*%0AMontant reçu: ${recu.montantPaye.toLocaleString()} GNF%0AMonnaie: ${recu.monnaie.toLocaleString()} GNF%0A%0AMerci de votre confiance!`
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
        {/* Colonne gauche — recherche + panier */}
        <div className="col-span-2 space-y-4">
          <div className="relative">
            <input
              type="text"
              placeholder="Rechercher un médicament (min 2 lettres)..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-lg"
            />
            {medicaments.length > 0 && (
              <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg z-10 mt-1">
                {medicaments.map((med) => (
                  <button
                    key={med.id}
                    onClick={() => ajouterAuPanier(med)}
                    disabled={med.stockTotal <= 0}
                    className="w-full text-left px-4 py-3 hover:bg-green-50 border-b last:border-0 flex justify-between items-center disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <div>
                      <span className="font-medium">{med.nom}</span>
                      {med.stockTotal <= 0 ? (
                        <span className="ml-2 text-xs text-red-500">Rupture de stock</span>
                      ) : med.stockTotal <= 10 ? (
                        <span className="ml-2 text-xs text-orange-500">{med.stockTotal} restants</span>
                      ) : (
                        <span className="ml-2 text-xs text-gray-400">{med.stockTotal} en stock</span>
                      )}
                    </div>
                    <span className="text-green-600 font-medium">{formatMontant(med.prixVente)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl shadow overflow-hidden">
            {panier.length === 0 ? (
              <div className="p-12 text-center text-gray-400">
                <p className="text-4xl mb-2">🛒</p>
                <p>Recherchez un médicament pour commencer</p>
                {sessionOuverte === false && (
                  <p className="text-red-400 text-sm mt-2">
                    Ouvrez d&apos;abord votre session caisse pour pouvoir vendre
                  </p>
                )}
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left px-4 py-3 text-gray-600">Médicament</th>
                    <th className="text-center px-4 py-3 text-gray-600">Quantité</th>
                    <th className="text-right px-4 py-3 text-gray-600">Prix unit.</th>
                    <th className="text-right px-4 py-3 text-gray-600">Total</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {panier.map((ligne) => (
                    <tr key={ligne.medicamentId} className="border-b last:border-0">
                      <td className="px-4 py-3">
                        <p className="font-medium">{ligne.nom}</p>
                        <p className="text-xs text-gray-400">{ligne.stockDisponible} en stock</p>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => modifierQuantite(ligne.medicamentId, ligne.quantite - 1)}
                            className="w-7 h-7 bg-gray-100 rounded-full hover:bg-gray-200 font-bold">
                            -
                          </button>
                          <span className="w-8 text-center">{ligne.quantite}</span>
                          <button
                            onClick={() => modifierQuantite(ligne.medicamentId, ligne.quantite + 1)}
                            disabled={ligne.quantite >= ligne.stockDisponible}
                            className="w-7 h-7 bg-gray-100 rounded-full hover:bg-gray-200 font-bold disabled:opacity-40">
                            +
                          </button>
                        </div>
                        {ligne.quantite >= ligne.stockDisponible && (
                          <p className="text-xs text-orange-500 mt-0.5">Stock max</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-600">{formatMontant(ligne.prixUnitaire)}</td>
                      <td className="px-4 py-3 text-right font-medium">{formatMontant(ligne.prixUnitaire * ligne.quantite)}</td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => modifierQuantite(ligne.medicamentId, 0)}
                          className="text-red-400 hover:text-red-600">
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Colonne droite — paiement */}
        <div className="bg-white rounded-xl shadow p-6 space-y-4 h-fit">
          <h2 className="font-semibold text-gray-700 text-lg">Paiement</h2>

          <div className="border-t pt-4">
            {remise > 0 && (
              <>
                <div className="flex justify-between text-sm text-gray-400 mb-1">
                  <span>Sous-total</span>
                  <span>{formatMontant(montantTotal)}</span>
                </div>
                <div className="flex justify-between text-sm text-orange-500 mb-1">
                  <span>Remise</span>
                  <span>-{formatMontant(remise)}</span>
                </div>
              </>
            )}
            <div className="flex justify-between text-lg font-bold mb-4">
              <span>Total</span>
              <span className="text-green-600">{formatMontant(totalNet)}</span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Client (optionnel)</label>
            <select value={clientId} onChange={(e) => setClientId(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500">
              <option value="">Client anonyme</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.nom}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Mode de paiement</label>
            <select value={modePaiement} onChange={(e) => setModePaiement(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500">
              <option value="ESPECES">Espèces</option>
              <option value="ORANGE_MONEY">Orange Money</option>
              <option value="MTN_MONEY">MTN Money</option>
              <option value="PAIEMENT_MARCHAND">Paiement Marchand</option>
              <option value="MOBILE_MONEY">Mobile Money</option>
              <option value="CARTE">Carte</option>
              <option value="CREDIT">Crédit</option>
            </select>
          </div>

          {modePaiement !== 'CREDIT' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Montant reçu (GNF)</label>
              <input
                type="number"
                value={montantPaye}
                onChange={(e) => setMontantPaye(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-lg"
                placeholder="0"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Remise (GNF)</label>
            <input
              type="number"
              min={0}
              max={montantTotal}
              value={remise || ''}
              onChange={(e) => setRemise(Math.max(0, Math.min(Number(e.target.value), montantTotal)))}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              placeholder="0"
            />
          </div>

          {montantPayeFloat > 0 && modePaiement !== 'CREDIT' && (
            <div className="bg-green-50 rounded-lg p-3 text-center">
              <p className="text-sm text-gray-500">Monnaie à rendre</p>
              <p className="text-2xl font-bold text-green-600">{formatMontant(monnaie)}</p>
            </div>
          )}

          <button
            onClick={validerVente}
            disabled={saving || !peutVendre}
            className="w-full bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium text-lg transition-colors"
            title={sessionOuverte === false ? 'Ouvrez votre session caisse avant de vendre' : ''}
          >
            {saving ? 'Enregistrement...' : sessionOuverte === false ? 'Session caisse requise' : 'Valider la vente'}
          </button>

          {sessionOuverte === false && (
            <p className="text-xs text-center text-red-400">
              <a href="/caisse" className="underline">Ouvrir ma session caisse →</a>
            </p>
          )}
        </div>
      </div>
    </div>
  )
}