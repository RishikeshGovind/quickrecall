'use client'
import { useState, FormEvent } from 'react'

export default function ResetRequestPage() {
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    const fd = new FormData(e.currentTarget)
    const email = String(fd.get('email') || '').trim()
    if (!email) { setError('Please enter your email.'); return }

    // Send JSON + also include as query fallback
    const res = await fetch(`/api/password/reset/request?email=${encodeURIComponent(email)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })

    const data = await res.json().catch(() => ({} as any))
    if (!res.ok) {
      setError(data.detail || data.error || `HTTP ${res.status}`)
      return
    }
    setDone(true)
  }

  return (
    <div className="card">
      <h1 className="text-xl font-semibold mb-4">Reset your password</h1>
      {done ? (
        <p className="text-gray-700">
          If that email exists, we’ve sent a reset link. In development, check your server console for the link.
        </p>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          {error && <p className="text-red-700">{error}</p>}
          <div>
            <label className="label" htmlFor="email">Email</label>
            <input className="input" id="email" name="email" type="email" required />
          </div>
          <button className="btn btn-primary" type="submit">Send reset link</button>
        </form>
      )}
    </div>
  )
}
