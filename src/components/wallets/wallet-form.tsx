'use client'

import { useState } from 'react'
import { Loader2, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils/cn'
import { normalizeEvmAddress } from '@/lib/wallets/address'

/**
 * Validation runs on every keystroke for fast feedback, and again on the server
 * before anything is written. The client check is a convenience, never the gate.
 */
export function WalletForm({
  onSubmit,
  isSubmitting,
  serverError,
}: {
  onSubmit: (input: { address: string; label: string | null }) => void
  isSubmitting: boolean
  serverError: string | null
}) {
  const [address, setAddress] = useState('')
  const [label, setLabel] = useState('')
  const [touched, setTouched] = useState(false)

  const validation = address.trim().length > 0 ? normalizeEvmAddress(address) : null
  const showError = touched && validation !== null && !validation.ok
  const canSubmit = validation?.ok === true && !isSubmitting

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setTouched(true)
    if (!validation?.ok) return
    onSubmit({ address: validation.address, label: label.trim() || null })
    setAddress('')
    setLabel('')
    setTouched(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-[1fr_200px_auto]">
        <div>
          <label
            htmlFor="wallet-address"
            className="mb-1.5 block text-[11px] font-medium tracking-wide text-terminal-muted uppercase"
          >
            Public EVM address
          </label>
          <input
            id="wallet-address"
            value={address}
            onChange={(event) => setAddress(event.target.value)}
            onBlur={() => setTouched(true)}
            placeholder="0x…"
            spellCheck={false}
            autoComplete="off"
            aria-invalid={showError}
            aria-describedby={showError ? 'wallet-address-error' : undefined}
            className={cn(
              'h-9 w-full rounded-lg border bg-terminal-void px-3 font-mono text-[13px] text-terminal-fg',
              'placeholder:text-terminal-faint focus:outline-none',
              showError
                ? 'border-signal-negative/50'
                : validation?.ok
                  ? 'border-signal-positive/40'
                  : 'border-terminal-border',
            )}
          />
        </div>

        <div>
          <label
            htmlFor="wallet-label"
            className="mb-1.5 block text-[11px] font-medium tracking-wide text-terminal-muted uppercase"
          >
            Label <span className="text-terminal-faint normal-case">(optional)</span>
          </label>
          <input
            id="wallet-label"
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            placeholder="Main LP wallet"
            maxLength={64}
            className="h-9 w-full rounded-lg border border-terminal-border bg-terminal-void px-3 text-[13px] text-terminal-fg placeholder:text-terminal-faint focus:outline-none"
          />
        </div>

        <div className="flex items-end">
          <Button type="submit" variant="primary" disabled={!canSubmit} className="w-full sm:w-auto">
            {isSubmitting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Plus className="size-4" />
            )}
            Track wallet
          </Button>
        </div>
      </div>

      {showError && validation && !validation.ok ? (
        <p id="wallet-address-error" className="text-[12px] text-signal-negative">
          {validation.message}
        </p>
      ) : null}

      {serverError ? <p className="text-[12px] text-signal-negative">{serverError}</p> : null}

      {validation?.ok && validation.wasChecksummed ? (
        <p className="text-[12px] text-signal-positive">EIP-55 checksum verified.</p>
      ) : null}
    </form>
  )
}
