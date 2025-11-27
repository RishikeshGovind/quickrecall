// app/page.tsx
export const runtime = 'nodejs'

import Link from 'next/link'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/** Server action: creates a small sample deck for the current user */
async function createSampleDeck() {
  'use server'
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return

  // If a sample deck already exists, don’t duplicate
  const existing = await prisma.deck.findFirst({
    where: { userId: session.user.id, name: 'Getting Started' },
    select: { id: true },
  })
  if (existing) return

  const deck = await prisma.deck.create({
    data: {
      userId: session.user.id,
      name: 'Getting Started',
      description: 'A quick taste of how reviews feel.',
    },
  })

  await prisma.card.createMany({
    data: [
      { deckId: deck.id, front: 'What is spaced repetition?', back: 'A method that schedules reviews over increasing intervals.' },
      { deckId: deck.id, front: 'What are the four grading buttons?', back: 'Again, Hard, Good, Easy.' },
      { deckId: deck.id, front: 'How do you earn XP in MC mode?', back: 'By selecting the correct option.' },
      { deckId: deck.id, front: 'What reduces a heart?', back: 'Answering “Again”/incorrect in MC mode.' },
    ],
  })
}

export default async function HomePage() {
  const session = await getServerSession(authOptions)
  const isAuthed = !!session?.user

  return (
    <div className="space-y-12">
      {/* HERO */}
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-50 via-sky-50 to-white border">
        <div className="max-w-3xl mx-auto px-6 py-12">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border bg-white/70 px-3 py-1 text-xs text-gray-700">
            <span>🔥 New</span>
            <span className="text-gray-500">Streaks, hearts & XP</span>
          </div>

          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
            Study that actually sticks.
          </h1>
          <p className="mt-3 text-gray-600 md:text-lg">
            QuickRecall helps you learn faster with smart review timing, a clean interface,
            and light gamification that keeps you motivated.
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            {!isAuthed ? (
              <>
                <Link href="/auth/signup" className="btn btn-primary">Get started — it’s free</Link>
                <Link href="/auth/login" className="btn">Log in</Link>
              </>
            ) : (
              <>
                <Link href="/decks" className="btn btn-primary">Go to my decks</Link>
                <form action={createSampleDeck}>
                  <button className="btn" type="submit" title="Creates a small deck if you don’t have one">
                    Create sample deck
                  </button>
                </form>
                <Link href="/leaderboard" className="btn">See leaderboard</Link>
              </>
            )}
          </div>

          <ul className="mt-6 grid grid-cols-1 gap-2 text-sm text-gray-600 sm:grid-cols-3">
            <li className="flex items-center gap-2"><span>⏱️</span> Spaced-repetition scheduling</li>
            <li className="flex items-center gap-2"><span>🎯</span> Multiple-choice & flip-cards</li>
            <li className="flex items-center gap-2"><span>🔥</span> Streaks, hearts & XP</li>
          </ul>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section>
        <h2 className="text-xl font-semibold mb-3">How it works</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="card">
            <div className="text-2xl">📚</div>
            <h3 className="font-semibold mt-2">Create or import</h3>
            <p className="text-gray-600 text-sm mt-1">
              Make decks from scratch or start with a sample. Each card has a front (prompt) and back (answer).
            </p>
          </div>
          <div className="card">
            <div className="text-2xl">🧠</div>
            <h3 className="font-semibold mt-2">Practice, your way</h3>
            <p className="text-gray-600 text-sm mt-1">
              Pick between multiple-choice or flip-card mode. Correct answers earn XP; mistakes cost a heart.
            </p>
          </div>
          <div className="card">
            <div className="text-2xl">📈</div>
            <h3 className="font-semibold mt-2">Smart review timing</h3>
            <p className="text-gray-600 text-sm mt-1">
              Cards come back just before you forget. Reviews stack up to a daily goal and a visible streak.
            </p>
          </div>
        </div>
      </section>

      {/* FEATURE HIGHLIGHTS */}
      <section className="grid gap-4 md:grid-cols-2">
        <div className="card">
          <h3 className="font-semibold mb-1">Stay motivated</h3>
          <p className="text-gray-600 text-sm">
            Earn XP each correct answer, keep your 🔥 streak, and challenge friends on the weekly leaderboard.
          </p>
          <ul className="mt-3 text-sm text-gray-700 space-y-1">
            <li>• Daily goal with progress bar</li>
            <li>• Hearts to make practice meaningful</li>
            <li>• Profile with GitHub-style practice calendar</li>
          </ul>
        </div>
        <div className="card">
          <h3 className="font-semibold mb-1">Simple & private</h3>
          <p className="text-gray-600 text-sm">
            Your content is yours. No ads, no trackers. Sign in with email & password; reset anytime.
          </p>
          <ul className="mt-3 text-sm text-gray-700 space-y-1">
            <li>• Clean, distraction-free UI</li>
            <li>• Server-side protection for your data</li>
            <li>• Export/import coming soon</li>
          </ul>
        </div>
      </section>

      {/* CALL TO ACTION */}
      <section className="rounded-xl border p-6 text-center">
        {!isAuthed ? (
          <>
            <h3 className="text-lg font-semibold">Ready to remember more with less effort?</h3>
            <p className="text-gray-600 mt-1">Create your free account in seconds.</p>
            <div className="mt-4 flex justify-center gap-3">
              <Link href="/auth/signup" className="btn btn-primary">Sign up</Link>
              <Link href="/auth/login" className="btn">Log in</Link>
            </div>
          </>
        ) : (
          <>
            <h3 className="text-lg font-semibold">Welcome back!</h3>
            <p className="text-gray-600 mt-1">Jump into your decks or try the sample to see what’s new.</p>
            <div className="mt-4 flex justify-center gap-3">
              <Link href="/decks" className="btn btn-primary">Go to my decks</Link>
              <form action={createSampleDeck}>
                <button className="btn" type="submit">Create sample deck</button>
              </form>
              <Link href="/profile" className="btn">My profile</Link>
            </div>
          </>
        )}
      </section>

      {/* FAQ */}
      <section>
        <h2 className="text-xl font-semibold mb-3">FAQ</h2>
        <div className="grid gap-3">
          <div className="card">
            <p className="font-medium">What’s “spaced repetition”?</p>
            <p className="text-sm text-gray-600 mt-1">
              A study technique that schedules reviews at increasing intervals, so you retain facts with minimal effort.
            </p>
          </div>
          <div className="card">
            <p className="font-medium">Can I practice immediately?</p>
            <p className="text-sm text-gray-600 mt-1">
              Yes—use “Create sample deck” (once you’re logged in) to start in seconds.
            </p>
          </div>
          <div className="card">
            <p className="font-medium">Is my data safe?</p>
            <p className="text-sm text-gray-600 mt-1">
              Only you can access your decks. We use server-side auth and hashed passwords.
            </p>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="pt-6 pb-2 text-center text-xs text-gray-500">
        © {new Date().getFullYear()} QuickRecall. Study smarter.
      </footer>
    </div>
  )
}
