'use client'

import { useEffect, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

interface DonneeJour {
  date: string
  beneficeNet: number
}

export default function BeneficeEvolutionChart() {
  const [nbJours, setNbJours] = useState<15 | 30 | 90>(30)
  const [donnees, setDonnees] = useState<DonneeJour[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/rapports?type=graphique-benefice&jours=${nbJours}`)
      .then((res) => res.json())
      .then((json) => setDonnees(json.data?.jours ?? []))
      .finally(() => setLoading(false))
  }, [nbJours])

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-gray-600 text-sm">Évolution du bénéfice net</h3>
        <div className="flex gap-1 text-xs">
          {([15, 30, 90] as const).map((n) => (
            <button
              key={n}
              onClick={() => setNbJours(n)}
              className={`px-2 py-1 rounded-md ${nbJours === n ? 'bg-blue-100 text-blue-700 font-medium' : 'text-gray-400 hover:text-gray-600'}`}
            >
              {n}j
            </button>
          ))}
        </div>
      </div>
      {loading ? (
        <div className="h-[220px] flex items-center justify-center text-xs text-gray-400">Chargement...</div>
      ) : donnees.length === 0 ? (
        <div className="h-[220px] flex items-center justify-center text-xs text-gray-400">Aucune donnée sur cette période</div>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={donnees}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} interval={Math.ceil(nbJours / 8)} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip formatter={(value) => [`${Number(value).toLocaleString()} GNF`, 'Bénéfice net']} />
            <Line type="monotone" dataKey="beneficeNet" stroke="#2563eb" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
