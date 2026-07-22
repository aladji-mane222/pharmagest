'use client'

import { useEffect, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

interface DonneeJour {
  date: string
  beneficeNet: number
}

export default function BeneficeEvolutionChart() {
  const [donnees, setDonnees] = useState<DonneeJour[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/rapports?type=graphique-benefice')
      .then((res) => res.json())
      .then((json) => setDonnees(json.data?.jours ?? []))
      .finally(() => setLoading(false))
  }, [])

  if (loading || donnees.length === 0) return null

  return (
    <div>
      <h3 className="font-semibold text-gray-600 mb-3 text-sm">Évolution du bénéfice net (30 derniers jours)</h3>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={donnees}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="date" tick={{ fontSize: 11 }} interval={4} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip formatter={(value) => [`${Number(value).toLocaleString()} GNF`, 'Bénéfice net']} />
          <Line type="monotone" dataKey="beneficeNet" stroke="#2563eb" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}