"use client"

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut, useSession } from 'next-auth/react'

type MenuItem = {
  href: string
  label: string
  icon: string
}

type MenuGroup = {
  label: string
  caissierHidden?: boolean
  items: MenuItem[]
}

const menuGroups: MenuGroup[] = [
  {
    label: 'VENTES',
    items: [
      { href: '/dashboard',         label: 'Tableau de bord',   icon: '📊' },
      { href: '/ventes',            label: 'Point de Vente',    icon: '🛒' },
      { href: '/ventes/historique', label: 'Historique ventes', icon: '🧾' },
    ],
  },
  {
    label: 'STOCK',
    items: [
      { href: '/medicaments', label: 'Médicaments', icon: '💊' },
      { href: '/stock',       label: 'Stock',       icon: '📦' },
      { href: '/inventaire',  label: 'Inventaire',  icon: '📋' },
    ],
  },
  {
    label: 'CAISSE',
    items: [
      { href: '/caisse',   label: 'Caisse',   icon: '💰' },
      { href: '/depenses', label: 'Dépenses', icon: '💸' },
    ],
  },
  {
    label: 'CLIENTS',
    items: [
      { href: '/clients', label: 'Clients', icon: '👥' },
      { href: '/credits', label: 'Crédits', icon: '💳' },
    ],
  },
  {
    label: 'FOURNISSEURS',
    caissierHidden: true,
    items: [
      { href: '/fournisseurs',           label: 'Fournisseurs', icon: '🚚' },
      { href: '/fournisseurs/commandes', label: 'Commandes',    icon: '📝' },
    ],
  },
  {
    label: 'GESTION',
    caissierHidden: true,
    items: [
      { href: '/personnel',  label: 'Personnel',  icon: '👤' },
      { href: '/rapports',   label: 'Rapports',   icon: '📈' },
    ],
  },
  {
    // Parametres reste visible pour un CAISSIER (Phase 4, 23/07/2026) —
    // il peut changer le format de recu, l'API bloque tout le reste en
    // lecture seule pour lui (voir /api/parametres PATCH)
    label: 'GESTION',
    items: [
      { href: '/parametres', label: 'Paramètres', icon: '⚙️' },
    ],
  },
]

// Un lien est actif si le pathname correspond exactement, ou si pathname est un
// sous-chemin ET qu'aucun item plus précis de la liste ne correspond mieux.
const allHrefs = menuGroups.flatMap(g => g.items.map(i => i.href))

function isItemActive(itemHref: string, pathname: string): boolean {
  if (pathname === itemHref) return true
  if (!pathname.startsWith(itemHref + '/')) return false
  // Désactiver si un item plus précis (sous-route déclarée) correspond
  return !allHrefs.some(
    h => h !== itemHref && h.startsWith(itemHref + '/') && pathname.startsWith(h)
  )
}

export default function Sidebar() {
  const pathname = usePathname()
  const { data: session } = useSession()
  const isCaissier = session?.user?.role === 'CAISSIER'

  const rolLabel =
    session?.user?.role === 'SUPER_ADMIN' ? 'Super Admin'
    : session?.user?.role === 'ADMIN'     ? 'Administrateur'
    : 'Caissier'

  return (
    <aside
      className="w-64 min-h-screen flex flex-col"
      style={{ backgroundColor: '#0D2847' }}
    >
      {/* ── Logo ── */}
      <div className="p-6" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="flex items-center gap-2">
          <span className="text-2xl">💊</span>
          <div>
            <h1 className="text-lg font-bold text-white tracking-wide">PharmaGest</h1>
            <p className="text-xs mt-0.5" style={{ color: '#2ECC8A' }}>Pilotée par vous</p>
          </div>
        </div>
      </div>

      {/* ── Navigation ── */}
      <nav className="flex-1 py-3 overflow-y-auto">
        {menuGroups.map((group) => {
          if (group.caissierHidden && isCaissier) return null

          return (
            <div key={group.label} className="mb-2">
              <p
                className="px-4 pt-3 pb-1 text-xs font-semibold tracking-widest"
                style={{ color: 'rgba(255,255,255,0.30)' }}
              >
                {group.label}
              </p>

              {group.items.map((item) => {
                const active = isItemActive(item.href, pathname)

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="flex items-center gap-3 mx-2 px-3 py-2 rounded-lg text-sm transition-all"
                    style={{
                      backgroundColor: active ? '#2ECC8A' : 'transparent',
                      color: active ? '#0D2847' : 'rgba(255,255,255,0.72)',
                      fontWeight: active ? 600 : 400,
                    }}
                    onMouseEnter={e => {
                      if (!active) {
                        const el = e.currentTarget as HTMLElement
                        el.style.backgroundColor = 'rgba(255,255,255,0.07)'
                        el.style.color = '#ffffff'
                      }
                    }}
                    onMouseLeave={e => {
                      if (!active) {
                        const el = e.currentTarget as HTMLElement
                        el.style.backgroundColor = 'transparent'
                        el.style.color = 'rgba(255,255,255,0.72)'
                      }
                    }}
                  >
                    <span className="text-base leading-none">{item.icon}</span>
                    <span className="flex-1">{item.label}</span>
                    {active && (
                      <span
                        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: '#0D2847' }}
                      />
                    )}
                  </Link>
                )
              })}
            </div>
          )
        })}
      </nav>

      {/* ── Utilisateur + déconnexion ── */}
      <div className="p-4" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="flex items-center gap-3 mb-3">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
            style={{ backgroundColor: '#2ECC8A', color: '#0D2847' }}
          >
            {session?.user?.name?.charAt(0).toUpperCase() ?? '?'}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-white truncate">
              {session?.user?.name}
            </p>
            <p className="text-xs truncate" style={{ color: '#2ECC8A' }}>
              {rolLabel}
            </p>
          </div>
        </div>

        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="w-full flex items-center gap-2 text-xs px-1 py-1 rounded transition-colors"
          style={{ color: 'rgba(255,255,255,0.40)' }}
          onMouseEnter={e => (e.currentTarget.style.color = '#ffffff')}
          onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.40)')}
        >
          <span>→</span>
          <span>Se déconnecter</span>
        </button>
      </div>
    </aside>
  )
}
