import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Helios Demo',
  description: 'A static GitHub Pages demo that mirrors the Helios start page and backend workspace.',
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
