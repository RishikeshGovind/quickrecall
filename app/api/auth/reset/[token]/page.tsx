'use client'
import { useState, FormEvent } from 'react'
import { useParams, useRouter } from 'next/navigation'

export default function ResetWithTokenPage() {
  const { token } = useParams<{ token: string }>()
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const fd = new FormData(e.currentTarget)
    const pw = String(fd.get('password') || '')
    const pw2 = String(fd.get('confirm') || '')
    if (pw.length < 6) return setError('Password must be at least 6 characters')
    if (pw !== pw2) return setError('Passwords do not match')

    setLoading(true)
    const res = await fetch('/api/auth/reset/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, newPassword: pw }),
    })
    setLoading(false)
    const j = await res.json().catch(() => ({}))
    if (!res.ok) {
      setError(j.error || 'Invalid or expired link')
      return
    }
    router.push('/auth/login?m=reset')
  }

  return (
    <div className="card">
      <h1 className="text-xl font-semibold mb-4">Choose a new password</h1>
      <form onSubmit={onSubmit} className="space-y-4">
        {error && <p className="text-red-700">{error}</p>}
        <div>
          <label className="label" htmlFor="password">New password</label>
          <input className="input" id="password" name="password" type="password" required minLength={6} />
        </div>
        <div>
          <label className="label" htmlFor="confirm">Confirm new password</label>
          <input className="input" id="confirm" name="confirm" type="password" required minLength={6} />
        </div>
        <button className="btn btn-primary" type="submit" disabled={loading}>
          {loading ? 'Saving…' : 'Save new password'}
        </button>
      </form>
    </div>
  )
}
