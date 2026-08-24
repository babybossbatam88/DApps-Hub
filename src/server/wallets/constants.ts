import type { Address } from 'viem'

/**
 * EIP-7528: the conventional pseudo-address for a chain's native asset.
 *
 * Native ETH has no ERC-20 contract, but `WalletBalance` needs a `Token` row to
 * reference. Using the standard placeholder rather than an invented one means
 * any future import/export lines up with other tooling.
 */
export const NATIVE_ASSET_ADDRESS = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE' as Address
