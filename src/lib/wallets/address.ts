import { getAddress, type Address } from 'viem'

/**
 * Public EVM address validation.
 *
 * Pure and dependency-light so it can run identically in the browser (instant
 * inline feedback) and on the server (the authoritative check before anything
 * is persisted). Never trust the client-side pass — the route re-validates.
 */

export type AddressValidation =
  | { ok: true; address: Address; wasChecksummed: boolean }
  | { ok: false; reason: AddressRejection; message: string }

export type AddressRejection =
  | 'EMPTY'
  | 'ENS_UNSUPPORTED'
  | 'BAD_FORMAT'
  | 'BAD_CHECKSUM'
  | 'ZERO_ADDRESS'

const HEX_ADDRESS = /^0x[0-9a-fA-F]{40}$/
const ZERO = '0x0000000000000000000000000000000000000000'

export function normalizeEvmAddress(input: string): AddressValidation {
  const value = input.trim()

  if (value.length === 0) {
    return { ok: false, reason: 'EMPTY', message: 'Enter a public EVM address.' }
  }

  // ENS names need a mainnet resolver call. Rejecting with a specific message
  // beats a generic "invalid address" that leaves the user retyping a name that
  // was never going to work.
  if (value.toLowerCase().endsWith('.eth') || value.includes('.')) {
    return {
      ok: false,
      reason: 'ENS_UNSUPPORTED',
      message: 'ENS names are not supported yet. Paste the 0x… address instead.',
    }
  }

  if (!HEX_ADDRESS.test(value)) {
    const hint = value.startsWith('0x')
      ? `An address is 42 characters; this one is ${value.length}.`
      : 'An address starts with 0x.'
    return { ok: false, reason: 'BAD_FORMAT', message: `That is not a valid EVM address. ${hint}` }
  }

  const body = value.slice(2)
  const isMixedCase = /[A-F]/.test(body) && /[a-f]/.test(body)

  // A mixed-case address carries an EIP-55 checksum. If it does not verify, the
  // address was mistyped or corrupted in transit — accepting it would silently
  // track the wrong wallet, so it is rejected rather than lowercased away.
  if (isMixedCase) {
    let checksummed: string
    try {
      checksummed = getAddress(value)
    } catch {
      return {
        ok: false,
        reason: 'BAD_CHECKSUM',
        message: 'This address fails its EIP-55 checksum. Check it for a typo.',
      }
    }
    if (checksummed !== value) {
      return {
        ok: false,
        reason: 'BAD_CHECKSUM',
        message: 'This address fails its EIP-55 checksum. Check it for a typo.',
      }
    }
  }

  const address = getAddress(value)

  if (address === ZERO) {
    return {
      ok: false,
      reason: 'ZERO_ADDRESS',
      message: 'The zero address cannot hold a position.',
    }
  }

  return { ok: true, address, wasChecksummed: isMixedCase }
}

/** Convenience for call sites that only need a boolean. */
export function isValidEvmAddress(input: string): boolean {
  return normalizeEvmAddress(input).ok
}
