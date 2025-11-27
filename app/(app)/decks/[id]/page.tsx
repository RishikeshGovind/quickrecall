// app/(app)/decks/[id]/page.tsx
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { notFound, redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import Link from 'next/link'

// server action: add a card
async function addCard(deckId: string, formData: FormData) {
  'use server'
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) throw new Error('Unauthorized')

  // ensure deck belongs to user
  const deck = await prisma.deck.findFirst({ where: { id: deckId, userId: session.user.id } })
  if (!deck) throw new Error('Not found')

  const front = String(formData.get('front') || '').trim()
  const back  = String(formData.get('back')  || '').trim()
  if (!front || !back) throw new Error('Front and back required')

  await prisma.card.create({ data: { deckId: deck.id, front, back } })
  revalidatePath(`/decks/${deckId}`)
}

// server action: delete a card
async function deleteCard(deckId: string, cardId: string) {
  'use server'
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) throw new Error('Unauthorized')

  const deck = await prisma.deck.findFirst({ where: { id: deckId, userId: session.user.id } })
  if (!deck) throw new Error('Not found')

  await prisma.card.delete({ where: { id: cardId } })
  revalidatePath(`/decks/${deckId}`)
}

export default async function DeckDetail({
  params,
}: {
  // 👈 Next 15: params must be awaited in server components
  params: Promise<{ id: string }>
}) {
  const { id } = await params   // ✅ await it once
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) redirect('/auth/login')

  const deck = await prisma.deck.findFirst({
    where: { id, userId: session.user.id }, // ✅ use the awaited id
    include: { cards: { orderBy: { createdAt: 'desc' } } },
  })
  if (!deck) notFound()

  return (
    <div className="space-y-6">
      <div className="card">
        <h1 className="text-xl font-semibold">{deck.name}</h1>
        {deck.description && <p className="text-gray-600">{deck.description}</p>}
        <div className="mt-4">
          <Link className="btn btn-primary" href={`/decks/${deck.id}/study`}>
            Study this deck
          </Link>
        </div>
      </div>

      <div className="card">
        <h2 className="text-lg font-semibold mb-3">Cards</h2>
        {deck.cards.length === 0 ? (
          <p className="text-gray-600">No cards yet. Add one below.</p>
        ) : (
          <ul className="space-y-2">
            {deck.cards.map(card => (
              <li key={card.id} className="border rounded-lg p-3 flex justify-between items-start">
                <div>
                  <p className="font-medium">{card.front}</p>
                  <p className="text-gray-700">{card.back}</p>
                </div>
                <form action={deleteCard.bind(null, deck.id, card.id)}>
                  <button className="btn btn-danger" type="submit">Delete</button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="card">
        <h2 className="text-lg font-semibold mb-3">Add a card</h2>
        <form action={addCard.bind(null, deck.id)} className="space-y-3">
          <div>
            <label className="label" htmlFor="front">Front</label>
            <textarea className="input" id="front" name="front" rows={2} required />
          </div>
          <div>
            <label className="label" htmlFor="back">Back</label>
            <textarea className="input" id="back" name="back" rows={2} required />
          </div>
          <button className="btn btn-primary" type="submit">Add card</button>
        </form>
      </div>
    </div>
  )
}
