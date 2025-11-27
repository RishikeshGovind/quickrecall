'use client'

import { mutate as swrMutate } from 'swr'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'

type Mode = 'mc' | 'flashcard'
type Grade = 'Again' | 'Hard' | 'Good' | 'Easy'

type Card = { id: string; front: string; back: string }
type QueueItem = { card: Card; choices: string[] | null }

export default function StudyPage() {
  const { id: deckId } = useParams<{ id: string }>()

  const [mode, setMode] = useState<Mode>('mc')

  const [current, setCurrent] = useState<QueueItem | null>(null)
  const [prefetched, setPrefetched] = useState<QueueItem | null>(null)
  const [prefetching, setPrefetching] = useState(false)

  const [seenCardIds, setSeenCardIds] = useState<string[]>([])
  const [sessionKey, setSessionKey] = useState(0)

  const [initialLoading, setInitialLoading] = useState(true)
  const [changingCard, setChangingCard] = useState(false)
  const [done, setDone] = useState(false)

  // flashcard flip
  const [showBack, setShowBack] = useState(false)

  // MC state
  const [selected, setSelected] = useState<string | null>(null)
  const [checked, setChecked] = useState(false)
  const [wasCorrect, setWasCorrect] = useState<boolean | null>(null)
  const [savingAnswer, setSavingAnswer] = useState(false)

  // -----------------------------
  // Fetch helpers
  // -----------------------------

  async function fetchOneCard(
    excludeIds: string[],
  ): Promise<QueueItem | 'empty' | 'error'> {
    if (!deckId) return 'error'

    try {
      const res = await fetch('/api/review/next', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deckId,
          mode: mode === 'mc' ? 'mc' : 'reveal',
          excludeCardIds: excludeIds,
        }),
      })

      if (!res.ok) {
        console.error('next failed', await res.text())
        return 'error'
      }

      const data = await res.json().catch(() => ({} as any))

      if (data.empty || !data.card) {
        return 'empty'
      }

      const nextCard: Card = {
        id: data.card.id,
        front: data.card.front,
        back: data.card.back,
      }

      const choices: string[] | null = Array.isArray(data.choices)
        ? data.choices
        : null

      return {
        card: nextCard,
        choices,
      }
    } catch (err) {
      console.error('next error:', err)
      return 'error'
    }
  }

  async function prefetchNext() {
    if (!deckId) return
    if (prefetching || prefetched) return

    setPrefetching(true)
    try {
      const result = await fetchOneCard(seenCardIds)
      if (result === 'empty' || result === 'error') {
        return
      }

      setPrefetched(result)
      setSeenCardIds((prev) =>
        prev.includes(result.card.id) ? prev : [...prev, result.card.id],
      )
    } finally {
      setPrefetching(false)
    }
  }

  async function loadInitial() {
    if (!deckId) return

    setInitialLoading(true)
    setDone(false)
    setCurrent(null)
    setPrefetched(null)
    setSeenCardIds([])
    setShowBack(false)
    setSelected(null)
    setChecked(false)
    setWasCorrect(null)

    const result = await fetchOneCard([])
    if (result === 'empty') {
      setDone(true)
      setInitialLoading(false)
      return
    }
    if (result === 'error') {
      setInitialLoading(false)
      return
    }

    setCurrent(result)
    setSeenCardIds([result.card.id])
    setInitialLoading(false)

    void prefetchNext()
  }

  async function loadNext() {
    if (!deckId) return
    if (changingCard) return

    setChangingCard(true)
    setShowBack(false)
    setSelected(null)
    setChecked(false)
    setWasCorrect(null)

    if (prefetched) {
      const next = prefetched
      setPrefetched(null)
      setCurrent(next)
      setChangingCard(false)
      void prefetchNext()
      return
    }

    const result = await fetchOneCard(seenCardIds)
    if (result === 'empty') {
      setCurrent(null)
      setDone(true)
      setChangingCard(false)
      return
    }
    if (result === 'error') {
      setChangingCard(false)
      return
    }

    setCurrent(result)
    setSeenCardIds((prev) =>
      prev.includes(result.card.id) ? prev : [...prev, result.card.id],
    )
    setChangingCard(false)

    void prefetchNext()
  }

  // -----------------------------
  // Session reset
  // -----------------------------

  // restart session when deck or mode changes
  useEffect(() => {
    setDone(false)
    setPrefetched(null)
    setSeenCardIds([])
    setSessionKey((n) => n + 1)
  }, [deckId, mode])

  useEffect(() => {
    void loadInitial()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionKey])

  // -----------------------------
  // Answer handlers
  // -----------------------------

  // FLASHCARD: grade & go to next immediately, save in background
  async function grade(grade: Grade) {
    if (!current || savingAnswer) return

    const answeredCardId = current.card.id

    setSavingAnswer(true)

    // show next card instantly; save in background
    void loadNext()

    try {
      const res = await fetch('/api/review/answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cardId: answeredCardId, grade }),
      })

      if (!res.ok) {
        console.error('answer failed', await res.text())
        return
      }

      // Update global gamification bar; inline XP removed
      swrMutate('/api/gamify/summary')
    } catch (err) {
      console.error('answer error:', err)
    } finally {
      setSavingAnswer(false)
    }
  }

  // MC: show correct/incorrect instantly, save in background
  async function submitMC() {
    if (!current || !selected || savingAnswer) return

    const currentCard = current.card
    const chosen = selected

    const correct = chosen === currentCard.back
    const grade: Grade = correct ? 'Good' : 'Again'

    // Instant UI feedback
    setWasCorrect(correct)
    setChecked(true)
    setSavingAnswer(true)

    try {
      const res = await fetch('/api/review/answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cardId: currentCard.id, grade, correct }),
      })

      if (!res.ok) {
        console.error('answer failed', await res.text())
        return
      }

      // Just bump the top bar
      swrMutate('/api/gamify/summary')
    } catch (err) {
      console.error('answer error:', err)
    } finally {
      setSavingAnswer(false)
    }
  }

  async function rescheduleAllNow() {
    if (!deckId) return
    await fetch('/api/review/reschedule', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deckId }),
    })
    setDone(false)
    setPrefetched(null)
    setSeenCardIds([])
    setSessionKey((n) => n + 1)
  }

  // -----------------------------
  // Rendering
  // -----------------------------

  if (initialLoading && !current && !done) {
    return <div className="card">Loading…</div>
  }

  if (done) {
    return (
      <div className="card space-y-3">
        <div className="text-lg font-semibold">You’re done for now 🎉</div>
        <p className="text-sm text-gray-600">
          You’ve reviewed all due cards in this deck (for this round).
        </p>
        <div className="flex gap-2">
          <button className="btn btn-primary" onClick={rescheduleAllNow}>
            Study again now
          </button>
        </div>
      </div>
    )
  }

  if (!current) {
    return <div className="card">No cards to study.</div>
  }

  const card = current.card
  const choices = current.choices

  return (
    <div className="flex flex-col gap-4">
      {/* Mode toggle */}
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-lg font-semibold">Study</h1>
        <div className="flex items-center gap-2">
          <button
            className={`btn btn-sm ${
              mode === 'mc' ? 'btn-primary' : 'btn-outline'
            }`}
            disabled={savingAnswer || changingCard}
            onClick={() => setMode('mc')}
          >
            Multiple choice
          </button>
          <button
            className={`btn btn-sm ${
              mode === 'flashcard' ? 'btn-primary' : 'btn-outline'
            }`}
            disabled={savingAnswer || changingCard}
            onClick={() => setMode('flashcard')}
          >
            Flashcard
          </button>
        </div>
      </div>

      <div className="card space-y-4">
        {mode === 'flashcard' ? (
          <>
            {/* FLASHCARD MODE */}
            <div className="space-y-2">
              <div className="text-sm text-gray-500">
                {showBack ? 'Answer' : 'Question'} – tap the card to flip
              </div>
              <div
                className="border rounded-xl p-6 bg-white shadow-sm cursor-pointer min-h-[140px] flex items-center justify-center text-center"
                onClick={() => setShowBack((v) => !v)}
              >
                <div className="whitespace-pre-wrap text-lg sm:text-xl text-gray-800">
                  {showBack ? card.back : card.front}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 justify-center">
              <button
                className="btn btn-sm btn-outline border-red-400 text-red-600"
                disabled={savingAnswer || changingCard}
                onClick={() => grade('Again')}
              >
                Again
              </button>
              <button
                className="btn btn-sm btn-outline border-yellow-400 text-yellow-700"
                disabled={savingAnswer || changingCard}
                onClick={() => grade('Hard')}
              >
                Hard
              </button>
              <button
                className="btn btn-sm btn-outline border-emerald-400 text-emerald-700"
                disabled={savingAnswer || changingCard}
                onClick={() => grade('Good')}
              >
                Good
              </button>
              <button
                className="btn btn-sm btn-primary"
                disabled={savingAnswer || changingCard}
                onClick={() => grade('Easy')}
              >
                Easy
              </button>
            </div>
          </>
        ) : (
          <>
            {/* MULTIPLE CHOICE MODE */}
            <div className="space-y-3">
              <div className="text-sm text-gray-500">Question</div>
              <div className="border rounded-lg p-3 bg-gray-50 whitespace-pre-wrap">
                {card.front}
              </div>
            </div>

            <div className="space-y-3">
              <div className="text-sm text-gray-500">Choose the answer</div>
              <div className="grid grid-cols-1 gap-2">
                {choices?.map((choice) => {
                  const isSelected = selected === choice
                  const isCorrect = choice === card.back
                  const showCorrect = checked && isCorrect
                  const showWrong = checked && isSelected && !isCorrect

                  let className = 'btn btn-outline justify-start w-full'
                  if (showCorrect) {
                    className += ' border-emerald-500 bg-emerald-50'
                  } else if (showWrong) {
                    className += ' border-red-500 bg-red-50'
                  } else if (isSelected) {
                    className += ' border-gray-400 bg-gray-50'
                  }

                  return (
                    <button
                      key={choice}
                      className={className}
                      onClick={() => {
                        if (checked) return
                        setSelected(choice)
                      }}
                    >
                      <span className="whitespace-pre-wrap text-left">
                        {choice}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>

            {choices && (
              <>
                {!checked ? (
                  <div className="flex justify-between items-center gap-3">
                    <span className="text-sm text-gray-500">
                      {selected ? 'Ready to check?' : 'Pick an answer'}
                    </span>
                    <button
                      className="btn btn-primary"
                      disabled={!selected || savingAnswer || changingCard}
                      onClick={submitMC}
                    >
                      {savingAnswer ? 'Checking…' : 'Check'}
                    </button>
                  </div>
                ) : (
                  <div className="flex justify-between items-center gap-3">
                    <div className="text-sm">
                      {wasCorrect ? (
                        <span className="text-emerald-700 font-medium">
                          Correct!
                        </span>
                      ) : (
                        <span className="text-red-600 font-medium">
                          Not quite.
                        </span>
                      )}
                    </div>
                    <button
                      className="btn btn-primary"
                      disabled={changingCard}
                      onClick={loadNext}
                    >
                      {changingCard ? 'Loading…' : 'Next'}
                    </button>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}
