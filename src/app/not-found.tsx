import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-terminal-base px-6 text-center">
      <p className="font-mono text-[11px] tracking-[0.2em] text-terminal-faint uppercase">404</p>
      <h1 className="text-xl font-semibold text-terminal-fg">This screen does not exist</h1>
      <p className="max-w-sm text-sm text-terminal-muted">
        The page you asked for is not part of the sitemap.
      </p>
      <Link href="/" className={buttonVariants({ variant: 'secondary' })}>
        Back to Overview
      </Link>
    </div>
  )
}
