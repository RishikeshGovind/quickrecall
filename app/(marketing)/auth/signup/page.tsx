'use client'
import { FormEvent, useState } from 'react'


export default function SignupPage() {
const [loading, setLoading] = useState(false)
const [error, setError] = useState<string | null>(null)


async function onSubmit(e: FormEvent<HTMLFormElement>) {
e.preventDefault()
setError(null)
const formData = new FormData(e.currentTarget)
const body = {
email: formData.get('email'),
password: formData.get('password'),
}
setLoading(true)
const res = await fetch('/api/auth/signup', {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify(body),
})
setLoading(false)
if (!res.ok) {
const j = await res.json().catch(() => ({}))
setError(j.error || 'Sign up failed')
return
}
// redirect to login with a small notice
window.location.href = '/auth/login?m=signedup'
}


return (
<div className="card">
    <h1 className="text-xl font-semibold mb-4">Create your account</h1>
    {error && <p className="mb-3 text-red-700">{error}</p>}
    <form onSubmit={onSubmit} className="space-y-4">
    <div>
        <label className="label" htmlFor="email">Email</label>
        <input className="input" id="email" name="email" type="email" required />
    </div>
    <div>
        <label className="label" htmlFor="password">Password</label>
        <input className="input" id="password" name="password" type="password" required minLength={6} />
    </div>
    <button disabled={loading} className="btn btn-primary w-full" type="submit">
    {loading ? 'Creating…' : 'Create account'}
    </button>
    </form>
</div>
)
}