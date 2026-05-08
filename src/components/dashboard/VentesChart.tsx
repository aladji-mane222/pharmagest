'use client'

import { useEffect, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

interface DonneeJour {
  date: string
  ca: number
  ventes: number
}

export default function VentesChart() {
  const [donnees, setDonnees] = useState<DonneeJour[]>([])

  useEffect(() => {
    fetch('/api/dashboard/graphique')
      .then((res) => res.json())
      .then((json) => setDonnees(json.data || []))
  }, [])

  if (donnees.length === 0) return null

  return (
    <div className="bg-white rounded-xl shadow p-6 mb-6">
      <h2 className="font-semibold text-gray-700 mb-4">CA des 7 derniers jours</h2>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={donnees}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="date" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} />
          <Tooltip
            formatter={(value: number) => [`${value.toLocaleString()} GNF`, 'CA']}
          />
          <Bar dataKey="ca" fill="#16a34a" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
