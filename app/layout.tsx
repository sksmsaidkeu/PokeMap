import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'PokeMap',
  description: 'GPS 기반 지역 확장형 포켓몬 RPG',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  )
}
