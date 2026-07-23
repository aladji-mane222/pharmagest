'use client'

import { useState } from 'react'

export interface SectionExportOption {
  key: string
  label: string
}

interface ExportPanelProps {
  sections: SectionExportOption[]
  onExporterExcel: (clesChoisies: string[]) => void
  onExporterCSV: (clesChoisies: string[]) => void
  onExporterPDF: (clesChoisies: string[]) => void
  generatingPDF?: boolean
}

// Panneau discret (Phase 4.8) qui s'ouvre au clic sur "Exporter" : une
// case par section disponible dans le rapport affiche, toutes cochees
// par defaut. Repond au constat de Nabe du 23/07/2026 : l'export ne
// reprenait jusqu'ici que le tableau principal, jamais les tableaux
// secondaires (repartition par fournisseur, top medicaments...).
export default function ExportPanel({
  sections, onExporterExcel, onExporterCSV, onExporterPDF, generatingPDF,
}: ExportPanelProps) {
  const [ouvert, setOuvert] = useState(false)
  const [cochees, setCochees] = useState<Set<string>>(new Set(sections.map((s) => s.key)))

  const toggle = (key: string) => {
    setCochees((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const clesChoisies = () => sections.map((s) => s.key).filter((k) => cochees.has(k))

  return (
    <div className="relative inline-block">
      <button
        onClick={() => setOuvert((o) => !o)}
        className="text-xs text-gray-500 hover:text-blue-600 hover:underline"
      >
        Exporter ▾
      </button>

      {ouvert && (
        <div className="absolute right-0 z-10 mt-2 w-72 bg-white border border-gray-200 rounded-lg shadow-lg p-4">
          <p className="text-xs font-medium text-gray-600 mb-2">Sections à inclure</p>
          <div className="space-y-2 mb-3">
            {sections.map((s) => (
              <label key={s.key} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={cochees.has(s.key)}
                  onChange={() => toggle(s.key)}
                  className="rounded border-gray-300"
                />
                {s.label}
              </label>
            ))}
          </div>
          <div className="flex gap-2 pt-2 border-t border-gray-100">
            <button
              onClick={() => { onExporterExcel(clesChoisies()); setOuvert(false) }}
              disabled={cochees.size === 0}
              className="flex-1 text-xs bg-blue-50 text-blue-700 rounded-md py-2 hover:bg-blue-100 disabled:opacity-40"
            >
              Excel
            </button>
            <button
              onClick={() => { onExporterCSV(clesChoisies()); setOuvert(false) }}
              disabled={cochees.size === 0}
              className="flex-1 text-xs bg-gray-100 text-gray-700 rounded-md py-2 hover:bg-gray-200 disabled:opacity-40"
            >
              CSV
            </button>
            <button
              onClick={() => { onExporterPDF(clesChoisies()); setOuvert(false) }}
              disabled={cochees.size === 0 || generatingPDF}
              className="flex-1 text-xs bg-red-50 text-red-700 rounded-md py-2 hover:bg-red-100 disabled:opacity-40"
            >
              {generatingPDF ? '...' : 'PDF'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
