'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Modal, Card, PageHeader, Button, Input, Select } from '@/components/ui'

export default function NouveauMedicamentPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [avertissementNom, setAvertissementNom] = useState<string | null>(null)
  const [form, setForm] = useState({
    nom: '',
    description: '',
    categorie: '',
    unite: 'comprime',
    prixVente: '',
    prixAchat: '',
    stockMinimum: '10',
    codeBarre: '',
    dci: '',
    ordonnanceObligatoire: false,
  })

  const soumettre = async (forcerCreation: boolean) => {
    setLoading(true)
    setError('')

    const res = await fetch('/api/medicaments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, forcerCreation }),
    })

    const json = await res.json()

    if (!res.ok) {
      if (json.details?.avertissement) {
        // Pas un vrai blocage — nom proche d'un medicament existant,
        // on demande confirmation plutot que de bloquer (meme principe
        // que fournisseurs, demande le 24/07/2026)
        setAvertissementNom(json.details.nomSimilaire)
        setLoading(false)
        return
      }
      setError(json.error || 'Erreur lors de la creation')
      setLoading(false)
    } else {
      router.push('/medicaments')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    soumettre(false)
  }

  return (
    <div className="p-8 max-w-2xl">
      <PageHeader title="Nouveau médicament" />

      <Card>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Nom"
            required
            value={form.nom}
            onChange={(e) => setForm({ ...form, nom: e.target.value })}
            placeholder="Ex: Paracetamol 500mg"
          />

          <Input
            label="Catégorie"
            value={form.categorie}
            onChange={(e) => setForm({ ...form, categorie: e.target.value })}
            placeholder="Ex: Analgesique"
          />

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Prix de vente (GNF)"
              required
              type="number"
              value={form.prixVente}
              onChange={(e) => setForm({ ...form, prixVente: e.target.value })}
              placeholder="0"
            />
            <Input
              label="Prix d'achat (GNF)"
              type="number"
              value={form.prixAchat}
              onChange={(e) => setForm({ ...form, prixAchat: e.target.value })}
              placeholder="0"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Unité"
              value={form.unite}
              onChange={(e) => setForm({ ...form, unite: e.target.value })}
            >
              <option value="comprime">Comprime</option>
              <option value="flacon">Flacon</option>
              <option value="ampoule">Ampoule</option>
              <option value="boite">Boite</option>
              <option value="sachet">Sachet</option>
            </Select>
            <Input
              label="Stock minimum"
              type="number"
              value={form.stockMinimum}
              onChange={(e) => setForm({ ...form, stockMinimum: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Code-barres"
              value={form.codeBarre}
              onChange={(e) => setForm({ ...form, codeBarre: e.target.value })}
              placeholder="Scanner ou saisir le code"
            />
            <Input
              label="DCI (nom générique)"
              value={form.dci}
              onChange={(e) => setForm({ ...form, dci: e.target.value })}
              placeholder="Ex: Paracetamol"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="ordonnanceObligatoire"
              checked={form.ordonnanceObligatoire}
              onChange={(e) => setForm({ ...form, ordonnanceObligatoire: e.target.checked })}
              className="w-4 h-4 rounded border-gray-300 text-mint focus:ring-mint"
            />
            <label htmlFor="ordonnanceObligatoire" className="text-sm font-medium text-navy">
              Vente sur ordonnance uniquement
            </label>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-navy">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full rounded-card border border-gray-200 px-3 py-2.5 text-sm text-navy focus:outline-none focus:ring-2 focus:ring-mint/50 focus:border-mint"
              rows={3}
              placeholder="Description optionnelle"
            />
          </div>

          {error && <p className="text-danger text-sm">{error}</p>}

          <div className="flex gap-3 pt-2">
            <Button type="submit" variant="primary" loading={loading}>
              Enregistrer
            </Button>
            <Button type="button" variant="secondary" onClick={() => router.back()}>
              Annuler
            </Button>
          </div>
        </form>
      </Card>

      <Modal
        open={!!avertissementNom}
        onClose={() => setAvertissementNom(null)}
        onConfirm={() => soumettre(true)}
        title="Nom de médicament proche d'un existant"
        description={`Un médicament au nom proche existe déjà : "${avertissementNom}". Vérifie que ce n'est pas le même avant de continuer.`}
        variant="default"
        confirmLabel="Créer quand même"
        loading={loading}
      />
    </div>
  )
}