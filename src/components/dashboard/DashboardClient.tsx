'use client'

import { useEffect, useState } from 'react'
import { formatMontant } from '@/lib/utils'
import VentesChart from '@/components/dashboard/VentesChart'

interface DashboardClientProps {
  initialData: {
    caJour: number
    caMois: number
    stockBas: number
    peremptions: number
  }
}

export default function DashboardClient({ initialData }: DashboardClientProps) {
  const [sseData, setSseData] = useState<{ 
    caJour: number; 
    nbVentes: number; 
    stockBas: number; 
    sessionOuverte: boolean 
  } | null>(null)

  useEffect(() => {
    const eventSource = new EventSource('/api/dashboard/sse')

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        setSseData(data)
      } catch (err) {
        console.error("SSE parse error", err)
      }
    }

    eventSource.onerror = () => {
      eventSource.close()
    }

    return () => {
      eventSource.close()
    }
  }, [])

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-surface rounded-xl shadow p-6 border-l-4 border-success">
          <p className="text-sm text-gray-500 font-medium">CA du jour (Live)</p>
          <p className="text-2xl font-bold text-success mt-1">
            {formatMontant(sseData?.caJour ?? initialData.caJour)}
          </p>
          <p className="text-xs text-gray-400 mt-1">{sseData?.nbVentes ?? 0} ventes aujourd'hui</p>
        </div>
        <div className="bg-surface rounded-xl shadow p-6 border-l-4 border-info">
          <p className="text-sm text-gray-500 font-medium">CA du mois</p>
          <p className="text-2xl font-bold text-info-text mt-1">{formatMontant(initialData.caMois)}</p>
        </div>
        <div className="bg-surface rounded-xl shadow p-6 border-l-4 border-warning">
          <p className="text-sm text-gray-500 font-medium">Stock bas</p>
          <p className="text-2xl font-bold text-warning mt-1">
            {sseData?.stockBas ?? initialData.stockBas} medicaments
          </p>
        </div>
        <div className="bg-surface rounded-xl shadow p-6 border-l-4 border-danger">
          <p className="text-sm text-gray-500 font-medium">Peremptions 90j</p>
          <p className="text-2xl font-bold text-danger mt-1">{initialData.peremptions} lots</p>
        </div>
      </div>

      <div className={`mb-6 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
        sseData?.sessionOuverte 
          ? 'bg-success-bg text-success border border-success/20' 
          : 'bg-danger-bg text-danger border border-danger/20'
      }`}>
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${sseData?.sessionOuverte ? 'bg-success animate-pulse' : 'bg-danger'}`}></span>
          {sseData?.sessionOuverte ? 'Session caisse ouverte' : 'Aucune session caisse ouverte'}
        </div>
      </div>

      <VentesChart />
    </>
  )
}
