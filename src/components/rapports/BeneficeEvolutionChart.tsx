
'use client'

import { useEffect, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

interface DonneeJour {
  date: string
  beneficeNet: number
}

interface Props {
  debut: string
  fin: string
}

// Suit les dates du filtre en haut de page (Phase 4, 24/07/2026 — avant,
// des boutons fixes 15j/30j/90j deconnectes du filtre choisi ; Nabe a
// demande a pouvoir choisir librement, donc la source de verite est
// desormais le meme "debut"/"fin" que le reste du rapport).
export default function BeneficeEvolutionChart({ debut, fin }: Props) {
  const [donnees, setDonnees] = useState<DonneeJour[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/rapports?type=graphique-benefice&debut=${debut}&fin=${fin}`)
      .then((res) => res.json())
      .then((json) => setDonnees(json.data?.jours ?? []))
      .finally(() => setLoading(false))
  }, [debut, fin])

  return (
    <div>
      <h3 className="font-semibold text-gray-600 text-sm mb-3">Évolution du bénéfice net</h3>
      {loading ? (
        <div className="h-[220px] flex items-center justify-center text-xs text-gray-400">Chargement...</div>
      ) : donnees.length === 0 ? (
        <div className="h-[220px] flex items-center justify-center text-xs text-gray-400">Aucune donnée sur cette période</div>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={donnees}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} interval={Math.ceil(donnees.length / 8)} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip formatter={(value) => [`${Number(value).toLocaleString()} GNF`, 'Bénéfice net']} />
            <Line type="monotone" dataKey="beneficeNet" stroke="#2563eb" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      )}
      <p className="text-xs text-gray-400 mt-2">Suit la période sélectionnée dans le filtre ci-dessus.</p>
    </div>
  )
}