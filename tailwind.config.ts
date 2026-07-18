import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // DESIGN 레트로 레드(로그인/도감 상세 포인트). 흰 텍스트가 얹히는 표면 기준
        // WCAG AA(≥4.5:1)를 통과하는 톤으로 단일화 — 하드코딩 #dc2626/#e3350d 대체.
        'retro-red': '#c62d0b',
      },
    },
  },
  plugins: [],
}

export default config
