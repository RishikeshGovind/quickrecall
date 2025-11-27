// app/layout.tsx  ✅ (root only wraps html/body)
import './globals.css'

export const metadata = { title: 'QuickRecall', description: 'Study smarter' }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50">{children}</body>
    </html>
  )
}
