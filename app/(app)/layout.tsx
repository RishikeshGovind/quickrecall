// app/(app)/layout.tsx
export const runtime = 'nodejs'

import Link from 'next/link'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import GamificationBar from '@/components/GamificationBar'
import UserButton from '@/components/UserButton'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions)

  return (
    <>
      <header className="border-b bg-white sticky top-0 z-20">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
          <div className="min-w-0 flex items-center gap-4">
            <Link href="/" className="font-semibold truncate">QuickRecall</Link>
            {session?.user && (
              <nav className="hidden sm:flex items-center gap-3 text-sm text-gray-700">
                <Link href="/profile" className="hover:underline">Profile</Link>
                <Link href="/decks" className="hover:underline">Decks</Link>
                <Link href="/leaderboard" className="hover:underline">Leaderboard</Link>
              </nav>
            )}
          </div>
          <div className="min-w-0 flex items-center gap-3">
            <GamificationBar />
            <UserButton />
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">{children}</main>
    </>
  )
}
