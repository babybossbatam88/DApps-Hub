/**
 * Local Base JSON-RPC test double — DEVELOPMENT ONLY.
 *
 * This is a fixture, never a data source. It exists so the wallet sync path can
 * be exercised end to end (Multicall3 batching, on-chain `decimals()` reads,
 * uint256 balance persistence) on a machine that cannot reach a real node —
 * for example a CI sandbox with an egress allowlist.
 *
 * It is deliberately NOT importable from `src/`: nothing in the application can
 * reach it, and pointing `BASE_RPC_URLS` at it is an explicit, visible act.
 * Never run this against anything that matters, and never in `live` mode.
 *
 *   node scripts/mock-base-rpc.mjs [port]
 *
 * Then, in .env.local:
 *   BASE_RPC_URLS=http://127.0.0.1:8545
 */
import { createServer } from 'node:http'
import { decodeFunctionData, encodeFunctionResult, parseAbi } from 'viem'

const PORT = Number(process.argv[2] ?? 8545)
const CHAIN_ID = 8453
const BLOCK_NUMBER = 34_000_123n
const MULTICALL3 = '0xca11bde05977b3631167028862be2a173976ca11'

const ERC20_ABI = parseAbi([
  'function symbol() view returns (string)',
  'function name() view returns (string)',
  'function decimals() view returns (uint8)',
  'function balanceOf(address) view returns (uint256)',
])

const MULTICALL3_ABI = parseAbi([
  'struct Call3 { address target; bool allowFailure; bytes callData; }',
  'struct Result { bool success; bytes returnData; }',
  'function aggregate3(Call3[] calls) payable returns (Result[] returnData)',
])

/**
 * Multicall3's own helpers. viem routes `eth_getBalance` through
 * `getEthBalance` when multicall batching is on, so a double that only knows
 * ERC-20 calls fails in a way that looks like a contract revert.
 */
const MULTICALL3_HELPERS_ABI = parseAbi([
  'function getEthBalance(address addr) view returns (uint256)',
  'function getBlockNumber() view returns (uint256)',
  'function getCurrentBlockTimestamp() view returns (uint256)',
])

/**
 * Fixture chain state. Balances are chosen to match the worked example in
 * docs/calculations.md §5 so the numbers on screen are traceable to the doc.
 */
const NATIVE_BALANCE = 21_500_000_000_000_000n // 0.0215 ETH

const TOKENS = {
  '0x4200000000000000000000000000000000000006': {
    symbol: 'WETH',
    name: 'Wrapped Ether',
    decimals: 18,
    balance: 250_000_000_000_000_000n, // 0.25 WETH
  },
  '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913': {
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
    balance: 95_060_000n, // 95.06 USDC
  },
  '0xd9aaec86b65d86f6a7b5b1b0c42ffa531710b6ca': {
    symbol: 'USDbC',
    name: 'USD Base Coin',
    decimals: 6,
    balance: 0n, // held: none — a real zero, which must not be stored
  },
  '0xcbb7c0000ab88b473b1f5afd9ef808440eed33bf': {
    symbol: 'cbBTC',
    name: 'Coinbase Wrapped BTC',
    decimals: 8,
    balance: 137_000n, // 0.00137 cbBTC
  },
  '0x2ae3f1ec7f1f5012cfeab0185bfc7aa3cf0dec22': {
    symbol: 'cbETH',
    name: 'Coinbase Wrapped Staked ETH',
    decimals: 18,
    balance: 0n,
  },
  // Deliberately broken: decimals() reverts. The sync must report this token as
  // a failure and still complete the others — never guess 18.
  '0xfde4c96c8593536e31f229ea8f37b2ada2699bb2': {
    symbol: 'USDT',
    name: 'Tether USD',
    decimals: null,
    balance: 12_340_000n,
  },
}

function callMulticallHelper(data) {
  const { functionName } = decodeFunctionData({ abi: MULTICALL3_HELPERS_ABI, data })
  switch (functionName) {
    case 'getEthBalance':
      return encodeFunctionResult({
        abi: MULTICALL3_HELPERS_ABI,
        functionName,
        result: NATIVE_BALANCE,
      })
    case 'getBlockNumber':
      return encodeFunctionResult({
        abi: MULTICALL3_HELPERS_ABI,
        functionName,
        result: BLOCK_NUMBER,
      })
    case 'getCurrentBlockTimestamp':
      return encodeFunctionResult({
        abi: MULTICALL3_HELPERS_ABI,
        functionName,
        result: 1_760_000_000n,
      })
    default:
      throw new Error(`unsupported multicall helper ${functionName}`)
  }
}

function callToken(target, data) {
  if (target.toLowerCase() === MULTICALL3) return callMulticallHelper(data)

  const token = TOKENS[target.toLowerCase()]
  if (!token) throw new Error('no such token')

  const { functionName } = decodeFunctionData({ abi: ERC20_ABI, data })

  switch (functionName) {
    case 'symbol':
      return encodeFunctionResult({ abi: ERC20_ABI, functionName, result: token.symbol })
    case 'name':
      return encodeFunctionResult({ abi: ERC20_ABI, functionName, result: token.name })
    case 'decimals':
      if (token.decimals === null) throw new Error('execution reverted: decimals')
      return encodeFunctionResult({ abi: ERC20_ABI, functionName, result: token.decimals })
    case 'balanceOf':
      return encodeFunctionResult({ abi: ERC20_ABI, functionName, result: token.balance })
    default:
      throw new Error(`unsupported function ${functionName}`)
  }
}

function handleCall(params) {
  const [tx] = params
  const to = (tx.to ?? '').toLowerCase()

  if (to === MULTICALL3 && tx.data.startsWith('0x82ad56cb')) {
    const { args } = decodeFunctionData({ abi: MULTICALL3_ABI, data: tx.data })
    const calls = args[0]
    const results = calls.map((call) => {
      try {
        return { success: true, returnData: callToken(call.target, call.callData) }
      } catch {
        return { success: false, returnData: '0x' }
      }
    })
    return encodeFunctionResult({
      abi: MULTICALL3_ABI,
      functionName: 'aggregate3',
      result: results,
    })
  }

  return callToken(to, tx.data)
}

function dispatch(method, params = []) {
  switch (method) {
    case 'eth_chainId':
      return `0x${CHAIN_ID.toString(16)}`
    case 'eth_blockNumber':
      return `0x${BLOCK_NUMBER.toString(16)}`
    case 'net_version':
      return String(CHAIN_ID)
    case 'eth_getBalance':
      return `0x${NATIVE_BALANCE.toString(16)}`
    case 'eth_getCode':
      // Every known contract address reports code, so contract verification
      // exercises its success path too.
      return '0x60806040'
    case 'eth_call':
      return handleCall(params)
    case 'eth_gasPrice':
      return '0x5f5e100'
    default:
      throw new Error(`unsupported method ${method}`)
  }
}

function respondTo(request) {
  try {
    return { jsonrpc: '2.0', id: request.id, result: dispatch(request.method, request.params) }
  } catch (error) {
    return {
      jsonrpc: '2.0',
      id: request.id,
      error: { code: -32000, message: error instanceof Error ? error.message : String(error) },
    }
  }
}

createServer((req, res) => {
  let body = ''
  req.on('data', (chunk) => {
    body += chunk
  })
  req.on('end', () => {
    let payload
    try {
      payload = JSON.parse(body)
    } catch {
      res.writeHead(400).end('bad json')
      return
    }
    const result = Array.isArray(payload) ? payload.map(respondTo) : respondTo(payload)
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify(result))
  })
}).listen(PORT, '127.0.0.1', () => {
  console.log(`mock Base RPC (FIXTURE — not real data) on http://127.0.0.1:${PORT}`)
  console.log(`chain id ${CHAIN_ID}, block ${BLOCK_NUMBER}`)
})
