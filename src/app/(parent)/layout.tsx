'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession, signOut } from 'next-auth/react'

function DashIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <rect x="2" y="2" width="6" height="6" rx="1.5" fill="currentColor" opacity=".9" />
      <rect x="10" y="2" width="6" height="6" rx="1.5" fill="currentColor" opacity=".4" />
      <rect x="2" y="10" width="6" height="6" rx="1.5" fill="currentColor" opacity=".4" />
      <rect x="10" y="10" width="6" height="6" rx="1.5" fill="currentColor" opacity=".7" />
    </svg>
  )
}

function GradeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <rect x="3" y="2" width="12" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M6 7h6M6 10h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function HistoryIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <circle cx="9" cy="9" r="7" stroke="currentColor" strokeWidth="1.5" />
      <path d="M9 5v4l2.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function TeacherIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <circle cx="9" cy="6" r="3" stroke="currentColor" strokeWidth="1.5" />
      <path d="M3 15c0-3.314 2.686-6 6-6s6 2.686 6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function SignOutIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M6 14H3a1 1 0 01-1-1V3a1 1 0 011-1h3M11 11l3-3-3-3M14 8H6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

const NAV_ITEMS = [
  { href: '/parent/dashboard', label: 'Dashboard',   icon: <DashIcon /> },
  { href: '/parent/grades',    label: 'Grades',      icon: <GradeIcon /> },
  { href: '/parent/history',   label: 'History',     icon: <HistoryIcon /> },
  { href: '/parent/teachers',  label: 'Teachers',    icon: <TeacherIcon /> },
]

export default function ParentLayout({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession()
  const pathname = usePathname()

  useEffect(() => {
    if (status === 'unauthenticated') window.location.href = '/login'
    if (status === 'authenticated' && session?.user?.role !== 'PARENT') {
      window.location.href = '/unauthorized'
    }
  }, [status, session])

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f6f8fc]">
        <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const parentName =
    (session?.user as { firstName?: string })?.firstName ??
    session?.user?.name?.split(' ')[0] ??
    'Parent'

  return (
    <div className="flex min-h-screen bg-[#f6f8fc]">
      {/* Sidebar */}
      <aside className="hidden md:flex w-56 shrink-0 flex-col bg-[#2d1b69] text-white">
        {/* Wordmark */}
        <div className="flex items-center gap-3 h-14 px-4 border-b border-white/10">
          <div className="w-8 h-8 rounded-lg bg-violet-500 flex items-center justify-center font-bold text-xs text-white shrink-0">
            PE
          </div>
          <div>
            <div className="text-sm font-semibold tracking-tight">MICDS PE</div>
            <div className="text-xs text-violet-300">Parent Portal</div>
          </div>
        </div>

        {/* Name + read-only badge */}
        <div className="px-4 py-3 border-b border-white/10">
          <p className="text-xs text-violet-300 font-medium">Signed in as</p>
          <p className="text-sm font-semibold text-white truncate">{parentName}</p>
          <span className="inline-block mt-1 text-[9px] uppercase tracking-wider bg-white/10 text-violet-300 px-2 py-0.5 rounded-full">
            Read-only access
          </span>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-3 px-2">
          <ul className="space-y-0.5">
            {NAV_ITEMS.map((item) => {
              const active = pathname === item.href || pathname.startsWith(item.href + '/')
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 ${
                      active
                        ? 'bg-violet-600 text-white font-semibold'
                        : 'text-violet-200 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <span className="shrink-0">{item.icon}</span>
                    <span>{item.label}</span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>

        {/* Footer */}
        <div className="border-t border-white/10 p-2">
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="flex items-center gap-2.5 px-3 py-2 w-full rounded-xl text-sm text-violet-300 hover:bg-white/10 hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
          >
            <SignOutIcon />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="fixed top-0 left-0 right-0 z-30 md:hidden flex items-center justify-between h-12 px-4 bg-[#2d1b69] text-white shadow">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-violet-500 flex items-center justify-center font-bold text-xs">PE</div>
          <span className="font-semibold text-sm">MICDS PE — Parent</span>
        </div>
      </div>

      {/* Main */}
      <main className="flex-1 min-w-0 overflow-auto pb-20 md:pb-0 pt-12 md:pt-0">
        {children}
      </main>

      {/* Mobile bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 md:hidden bg-[#2d1b69] border-t border-white/10 flex" aria-label="Mobile navigation">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex-1 flex flex-col items-center justify-center py-2 gap-0.5 text-[10px] font-medium transition-colors ${
                active ? 'text-violet-300' : 'text-white/50 hover:text-white/80'
              }`}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
