import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { ParentAppShell } from '@/components/layout/ParentAppShell'

export default async function ParentLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'PARENT') redirect('/unauthorized')

  return (
    <ParentAppShell
      userName={session.user.name ?? undefined}
      userEmail={session.user.email ?? undefined}
    >
      {children}
    </ParentAppShell>
  )
}
