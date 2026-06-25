import { Metadata } from 'next'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

export const metadata: Metadata = { title: 'My Classes' }

export default async function StudentHistoryPage() {
  const session = await getServerSession(authOptions)
  if (!session) return null

  const student = await db.studentProfile.findUnique({ where: { userId: session.user.id } })
  if (!student) return <div className="p-6 text-gray-500">Student profile not found.</div>

  return (
    <div className="p-6 max-w-4xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">My Classes</h1>
      <p className="text-gray-500 text-sm">Your class history for the current school year. Scores are final once a rotation is completed.</p>
    </div>
  )
}
