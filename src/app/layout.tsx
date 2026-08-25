import type { Metadata, Viewport } from 'next'
import { Inter, JetBrains_Mono } from 'next/font/google'
import './globals.css'
import { Providers } from '@/components/providers'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

const mono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono-stack',
  display: 'swap',
})

export const metadata: Metadata = {
  title: {
    default: 'LP Command Center',
    template: '%s · LP Command Center',
  },
  description:
    'Analytics and decision-support for concentrated-liquidity providers: live position value, fees, LP vs HODL, divergence, and range risk.',
  robots: { index: false, follow: false },
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f6f7fa' },
    { media: '(prefers-color-scheme: dark)', color: '#080b14' },
  ],
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

/**
 * Applies the stored theme before first paint.
 *
 * Without this the page renders light, hydrates, then snaps to dark — a flash
 * that is far more jarring than the toggle itself. Kept tiny and dependency
 * free because it runs render-blocking.
 */
const THEME_SCRIPT = `try{var t=localStorage.getItem('lpcc:theme');if(t==='dark'){document.documentElement.dataset.theme='dark'}}catch(e){}`

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
