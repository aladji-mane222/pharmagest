"use client"

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut, useSession } from 'next-auth/react'

// Types for menu structure
type MenuItem = {
  href: string
  label: string
  icon: string
  adminOnly?: boolean
}

type MenuGroup = {
  label: string | null
  adminOnly?: boolean
  items: MenuItem[]
}

// ─── Structure groupée ────────────────────────────────────────────
const menuGroups: MenuGroup[] = [
  {
    label: null, // pas de titre pour le premier groupe
    items: [
      { href: '/dashboard', label: 'Tableau de bord', icon: '📊' },
    ],
  },
  {
    label: 'VENTES',
    items: [
      { href: '/ventes',            label: 'Point de vente',    icon: '🛒' },
      { href: '/ventes/historique', label: 'Historique',        icon: '🧾' },
    ],
  },
  {
    label: 'STOCK',
    items: [
      { href: '/medicaments',      label: 'Médicaments', icon: '💊' },
      { href: '/stock',            label: 'Stock',       icon: '📦' },
    ],
  },
  {
    label: 'CAISSE',
    items: [
      { href: '/caisse',   label: 'Ma caisse', icon: '💰' },
      { href: '/depenses', label: 'Dépenses',  icon: '💸' },
    ],
  },
  {
    label: 'CLIENTS',
    items: [
      { href: '/clients', label: 'Clients', icon: '👥' },
      { href: '/credits', label: 'Crédits', icon: '💳', adminOnly: true },
    ],
  },
  {
    label: 'FOURNISSEURS',
    adminOnly: true,
    items: [
      { href: '/fournisseurs',          label: 'Fournisseurs', icon: '🚚' },
      { href: '/fournisseurs/commandes',label: 'Commandes',    icon: '📝' },
    ],
  },
  {
    label: 'GESTION',
    adminOnly: true,
    items: [
      { href: '/inventaire', label: 'Inventaire', icon: '📋' },
      { href: '/rapports',   label: 'Rapports',   icon: '📈' },
      { href: '/personnel',  label: 'Personnel',  icon: '👤' },
      { href: '/parametres', label: 'Paramètres', icon: '⚙️' },
    ],
  },
]

export default function Sidebar() {
  const pathname = usePathname()
  const { data: session } = useSession()
  const isAdmin = session?.user?.role === 'ADMIN' || session?.user?.role === 'SUPER_ADMIN'

  return (
    <aside className="w-64 min-h-screen flex flex-col" style={{ backgroundColor: '#0D2847' }}>
      {/* Logo */}
      <div className="p-6" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="flex items-center gap-2">
          <span className="text-2xl">💊</span>
          <div>
            <h1 className="text-lg font-bold text-white tracking-wide">PharmaGest</h1>
            <p className="text-xs mt-0.5" style={{ color: '#2ECC8A' }}>Pilotée par vous</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 overflow-y-auto">
        {menuGroups.map((group, gi) => {
          // Masquer les groupes entièrement Admin si caissier
          if (group.adminOnly && !isAdmin) return null

          // Filtrer les items Admin dans les groupes mixtes
          const items = group.items.filter(item => !item.adminOnly || isAdmin)
          if (items.length === 0) return null

          return (
            <div key={gi} className="mb-1">
              {/* Titre de section */}
              {group.label && (
                <p className="px-4 pt-3 pb-1 text-xs font-semibold tracking-widest"
                   style={{ color: 'rgba(255,255,255,0.35)' }}>
                  {group.label}
                </p>
              )}

              {/* Liens */}
              {items.map((item) => {
                const isActive = pathname === item.href ||
                  (item.href !== '/dashboard' && pathname.startsWith(item.href + '/'))

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="flex items-center gap-3 mx-2 px-3 py-2 rounded-lg text-sm transition-all"
                    style={{
                      backgroundColor: isActive ? '#2ECC8A' : 'transparent',
                      color: isActive ? '#0D2847' : 'rgba(255,255,255,0.75)',
                      fontWeight: isActive ? 600 : 400,
                    }}
                    onMouseEnter={e => {
                      if (!isActive) {
                        (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(255,255,255,0.08)'
                        ;(e.currentTarget as HTMLElement).style.color = '#ffffff'
                      }
                    }}
                    onMouseLeave={e => {
                      if (!isActive) {
                        (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'
                        ;(e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.75)'
                      }
                    }}
                  >
                    <span className="text-base">{item.icon}</span>
                    <span>{item.label}</span>
                    {isActive && (
                      <span className="ml-auto w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#0D2847' }} />
                    )}
                  </Link>
                )
              })}
            </div>
          )
        })}
      </nav>

      {/* Utilisateur connecté */}
      <div className="p-4" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
               style={{ backgroundColor: '#2ECC8A', color: '#0D2847' }}>
            {session?.user?.name?.charAt(0).toUpperCase() ?? '?'}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-white truncate">{session?.user?.name}</p>
            <p className="text-xs truncate" style={{ color: '#2ECC8A' }}>
              {session?.user?.role === 'SUPER_ADMIN' ? 'Super Admin'
               : session?.user?.role === 'ADMIN' ? 'Administrateur'
               : 'Caissier'}
            </p>
          </div>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="w-full text-left text-xs transition-colors px-1"
          style={{ color: 'rgba(255,255,255,0.45)' }}
          onMouseEnter={e => (e.currentTarget.style.color = '#ffffff')}
          onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.45)')}
        >
          → Se déconnecter
        </button>
      </div>
    </aside>
  )
}