// lib/quiz.ts
import { prisma } from '@/lib/prisma'

export function shuffle<T>(arr: T[]): T[] {
  // returns a new shuffled array (no mutation of the input)
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/**
 * Return up to `n` distractor backs from the same deck,
 * excluding a specific cardId and (optionally) the correct back text.
 *
 * Tries to use other cards from this deck first. If there aren't
 * enough unique answers available, it fills with generic but
 * sensible filler options so that MC always has 4 choices total.
 */
export async function getDistractors(
  deckId: string,
  excludeCardId: string,
  correctBack?: string,
  n = 3,
): Promise<string[]> {
  const rows = await prisma.card.findMany({
    where: {
      deckId,
      id: { not: excludeCardId },
      ...(correctBack ? { back: { not: correctBack } } : {}),
    },
    select: { back: true },
    take: 100,
  })

  const uniqueBacks = Array.from(
    new Set(
      rows
        .map(r => (r.back ?? '').trim())
        .filter(Boolean),
    ),
  )

  // Use as many real answers as we can
  const picked: string[] = shuffle(uniqueBacks).slice(
    0,
    Math.min(n, uniqueBacks.length),
  )

  // Fill with generic distractors if there aren't enough
  const fillers = [
    'None of the above',
    'I am not sure',
    'Skip this one',
    'All of the above',
  ]

  for (const f of fillers) {
    if (picked.length >= n) break
    if (!correctBack || f !== correctBack) {
      if (!picked.includes(f)) picked.push(f)
    }
  }

  return picked
}
