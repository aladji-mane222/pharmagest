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
        <div className="bg-white rounded-xl shadow p-6 border-l-4 border-green-500">
          <p className="text-sm text-gray-500 font-medium">CA du jour (Live)</p>
          <p className="text-2xl font-bold text-green-600 mt-1">
            {formatMontant(sseData?.caJour ?? initialData.caJour)}
          </p>
          <p className="text-xs text-gray-400 mt-1">{sseData?.nbVentes ?? 0} ventes aujourd'hui</p>
        </div>
        <div className="bg-white rounded-xl shadow p-6 border-l-4 border-blue-500">
          <p className="text-sm text-gray-500 font-medium">CA du mois</p>
          <p className="text-2xl font-bold text-blue-600 mt-1">{formatMontant(initialData.caMois)}</p>
        </div>
        <div className="bg-white rounded-xl shadow p-6 border-l-4 border-orange-500">
          <p className="text-sm text-gray-500 font-medium">Stock bas</p>
          <p className="text-2xl font-bold text-orange-500 mt-1">
            {sseData?.stockBas ?? initialData.stockBas} medicaments
          </p>
        </div>
        <div className="bg-white rounded-xl shadow p-6 border-l-4 border-red-500">
          <p className="text-sm text-gray-500 font-medium">Peremptions 90j</p>
          <p className="text-2xl font-bold text-red-500 mt-1">{initialData.peremptions} lots</p>
        </div>
      </div>

      <div className={`mb-6 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
        sseData?.sessionOuverte 
          ? 'bg-green-100 text-green-700 border border-green-200' 
          : 'bg-red-100 text-red-700 border border-red-200'
      }`}>
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${sseData?.sessionOuverte ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></span>
          {sseData?.sessionOuverte ? 'Session caisse ouverte' : 'Aucune session caisse ouverte'}
        </div>
      </div>

      <VentesChart />
    </>
  )
}
