'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { signOut } from 'next-auth/react'

interface NavItem {
  href: string
  label: string
  icon: React.ReactNode
  badge?: number
}

const navItems: NavItem[] = [
  {
    href: '/(teacher)/dashboard',
    label: 'My Dashboard',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <rect x="1" y="1" width="6" height="6" rx="1" fill="currentColor" opacity=".8" />
        <rect x="9" y="1" width="6" height="6" rx="1" fill="currentColor" opacity=".4" />
        <rect x="1" y="9" width="6" height="6" rx="1" fill="currentColor" opacity=".4" />
        <rect x="9" y="9" width="6" height="6" rx="1" fill="currentColor" opacity=".8" />
      </svg>
    ),
  },
  {
    href: '/(teacher)/grade',
    label: 'Grade Students',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <circle cx="6" cy="5" r="3" stroke="currentColor" strokeWidth="1.5" />
        <path d="M1 13c0-2.761 2.239-5 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M10 10l1.5 1.5L14 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    href: '/(teacher)/mass-grading',
    label: 'Mass Grading Grid',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <rect x="1" y="1" width="14" height="3" rx="1" fill="currentColor" opacity=".5" />
        <rect x="1" y="6" width="14" height="2" rx=".5" fill="currentColor" opacity=".3" />
        <rect x="1" y="10" width="14" height="2" rx=".5" fill="currentColor" opacity=".3" />
        <rect x="1" y="14" width="14" height="1" rx=".5" fill="currentColor" opacity=".2" />
        <rect x="1" y="1" width="4" height="14" rx=".5" fill="currentColor" opacity=".15" />
      </svg>
    ),
  },
  {
    href: '/(teacher)/history',
    label: 'My History',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.5" />
        <path d="M8 4.5V8l2.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    href: '/(teacher)/upcoming',
    label: 'My Upcoming',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <rect x="2" y="3" width="12" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
        <path d="M5 1.5V4M11 1.5V4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M2 7h12" stroke="currentColor" strokeWidth="1" opacity=".5" />
        <rect x="5" y="9" width="2" height="2" rx=".3" fill="currentColor" opacity=".6" />
        <rect x="9" y="9" width="2" height="2" rx=".3" fill="currentColor" opacity=".3" />
      </svg>
    ),
  },
]

export default function TeacherLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { data: session } = useSession()
  const [collapsed, setCollapsed] = useState(false)

  // Keyboard shortcut: [ to collapse
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key === '[' && !e.metaKey && !e.ctrlKey) {
        const active = document.activeElement
        if (active?.tagName === 'INPUT' || active?.tagName === 'TEXTAREA') return
        setCollapsed((c) => !c)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const teacherName = (session?.user as { firstName?: string; name?: string })?.firstName
    ?? session?.user?.name?.split(' ')[0]
    ?? 'Teacher'

  return (
    <div className="flex min-h-screen bg-[#f4f6fb]">
      {/* Sidebar */}
      <aside
        className={`${
          collapsed ? 'w-14' : 'w-56'
        } shrink-0 flex flex-col bg-slate-900 text-white transition-all duration-200 overflow-hidden`}
        style={{ willChange: 'width' }}
      >
        {/* Wordmark */}
        <div className="flex items-center h-14 px-3 border-b border-slate-800 gap-2 shrink-0">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center font-bold text-xs text-white shrink-0">
            PE
          </div>
          {!collapsed && (
            <div className="overflow-hidden">
              <div className="text-sm font-semibold tracking-tight whitespace-nowrap">MICDS PE</div>
              <div className="text-xs text-slate-400 whitespace-nowrap">Teacher Portal</div>
            </div>
          )}
          <button
            onClick={() => setCollapsed((c) => !c)}
            title={collapsed ? 'Expand sidebar ([)' : 'Collapse sidebar ([)'}
            className={`${collapsed ? 'mx-auto' : 'ml-auto'} p-1 rounded text-slate-500 hover:text-white hover:bg-slate-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 shrink-0`}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              {collapsed ? (
                <path d="M5 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              ) : (
                <path d="M9 3L5 7l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              )}
            </svg>
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-3 px-2 overflow-y-auto">
          <ul className="space-y-0.5">
            {navItems.map((item) => {
              const active = pathname === item.href || pathname.startsWith(item.href + '/')
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    title={collapsed ? item.label : undefined}
                    className={`flex items-center gap-2.5 px-2 py-2 rounded-lg text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
                      active
                        ? 'bg-blue-600 text-white font-medium'
                        : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    <span className="shrink-0">{item.icon}</span>
                    {!collapsed && (
                      <span className="truncate whitespace-nowrap">{item.label}</span>
                    )}
                    {!collapsed && item.badge != null && item.badge > 0 && (
                      <span className="ml-auto bg-blue-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center shrink-0">
                        {item.badge}
                      </span>
                    )}
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>

        {/* Footer */}
        <div className="shrink-0 border-t border-slate-800 p-2">
          {!collapsed && (
            <div className="px-2 py-1.5 mb-1">
              <div className="text-xs font-medium text-slate-300 truncate">{teacherName}</div>
              <div className="text-xs text-slate-500 truncate">{session?.user?.email}</div>
            </div>
          )}
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            title="Sign out"
            className="flex items-center gap-2.5 px-2 py-2 w-full rounded-lg text-sm text-slate-400 hover:bg-slate-800 hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="shrink-0" aria-hidden="true">
              <path d="M6 14H3a1 1 0 01-1-1V3a1 1 0 011-1h3M11 11l3-3-3-3M14 8H6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {!collapsed && <span className="whitespace-nowrap">Sign Out</span>}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 min-w-0 overflow-auto">{children}</main>
    </div>
  )
}
