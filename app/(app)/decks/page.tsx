import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import Link from 'next/link'
import { revalidatePath } from 'next/cache'


async function createDeck(formData: FormData) {
'use server'
const session = await getServerSession(authOptions)
if (!session?.user?.id) throw new Error('Unauthorized')
const name = String(formData.get('name') || '').trim()
const description = String(formData.get('description') || '').trim() || null
if (!name) throw new Error('Name required')
await prisma.deck.create({ data: { userId: session.user.id, name, description } })
revalidatePath('/decks')
}


export default async function DecksPage() {
const session = await getServerSession(authOptions)
if (!session?.user?.id) return null
const decks = await prisma.deck.findMany({
where: { userId: session.user.id },
orderBy: { createdAt: 'desc' },
})


return (
    <div className="space-y-6">
        <div className="card">
            <h1 className="text-xl font-semibold mb-4">Your decks</h1>
            {decks.length === 0 ? (
            <p className="text-gray-600">No decks yet. Create your first one below.</p>
            ) : (
            <ul className="space-y-2">
            {decks.map(d => (
            <li key={d.id} className="flex items-center justify-between">
            <div>
                <Link href={`/decks/${d.id}`} className="font-medium hover:underline">{d.name}</Link>
                {d.description && <p className="text-gray-600 text-sm">{d.description}</p>}
            </div>
            <Link className="btn" href={`/decks/${d.id}/study`}>Study</Link>
            </li>
            ))}
            </ul>
            )}
        </div>


        <div className="card">
            <h2 className="text-lg font-semibold mb-3">Create a new deck</h2>
            <form action={createDeck} className="space-y-3">
        <div>
            <label className="label" htmlFor="name">Name</label>
            <input className="input" id="name" name="name" required />
        </div>
        <div>
            <label className="label" htmlFor="description">Description (optional)</label>
            <textarea className="input" id="description" name="description" rows={2} />
        </div>
            <button className="btn btn-primary" type="submit">Create deck</button>
            </form>
        </div>
    </div>
)
}