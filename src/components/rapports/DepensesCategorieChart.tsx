'use client'

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'

interface DepenseCategorie {
  categorie: string
  montant: number
}

const COULEURS = ['#2563eb', '#16a34a', '#f59e0b', '#dc2626', '#7c3aed', '#0891b2', '#db2777']

export default function DepensesCategorieChart({ donnees }: { donnees: DepenseCategorie[] }) {
  if (donnees.length === 0) return null

  return (
    <div>
      <h3 className="font-semibold text-gray-600 mb-3 text-sm">Répartition des dépenses par catégorie</h3>
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie
            data={donnees}
            dataKey="montant"
            nameKey="categorie"
            cx="50%"
            cy="50%"
            outerRadius={80}
            label={(entry) => entry.name}
          >
            {donnees.map((d, i) => (
              <Cell key={d.categorie} fill={COULEURS[i % COULEURS.length]} />
            ))}
          </Pie>
          <Tooltip formatter={(value) => [`${Number(value).toLocaleString()} GNF`, 'Montant']} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}