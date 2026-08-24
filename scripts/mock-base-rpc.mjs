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
const NPM = '0x03a520b32c04bf3beef7beb72e919cf822ed34f1'   // NonfungiblePositionManager
const FACTORY = '0x33128a8fc17869897dce68ed026d694621f6fdfd'
const POOL = '0xfbb6eed8e7aa03b138556eedaf5d271a5e1e43ef'   // cbBTC/USDC 0.30%
const OWNER = '0x4f3a120e72c76c22ae802d129f599bfdbc31cb81'
const USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'
const CBBTC = '0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf'

/**
 * One Uniswap V3 position, so the discovery path can be exercised whole:
 * enumerate -> positions() -> factory -> pool state -> ticks.
 * Ticks and liquidity are the values derived in the repo's fixture notes:
 * a cbBTC/USDC 0.30% range of roughly 69,206 - 86,928 USDC per cbBTC.
 */
const POSITION = {
  tokenId: 1348792n,
  token0: USDC, token1: CBBTC, fee: 3000,
  tickLower: -67680, tickUpper: -65400,
  liquidity: 61800000n,
  tokensOwed0: 0n, tokensOwed1: 0n
}
const CURRENT_TICK = -66480
const Q128 = 2n ** 128n

/**
 * Fee accumulators chosen so uncollected works out to ~1.42 USDC and
 * ~0.0000075 cbBTC. The global sits above the delta so feeGrowthInsideLast is
 * positive, as it always is on chain — a fixture that only works because the
 * uint256 wrap rescues it would not be testing the wrap honestly.
 */
function feeGrowthPair(target, liquidity) {
  const delta = (target * Q128) / liquidity
  const global = delta * 3n + 10n ** 30n
  return { global, last: global - delta }
}
const FG0 = feeGrowthPair(1_420_000n, POSITION.liquidity)
const FG1 = feeGrowthPair(750n, POSITION.liquidity)
const FEE_GROWTH_GLOBAL_0 = FG0.global
const FEE_GROWTH_GLOBAL_1 = FG1.global
POSITION.feeGrowthInside0Last = FG0.last
POSITION.feeGrowthInside1Last = FG1.last

// sqrtPriceX96 at CURRENT_TICK, from the same TickMath port the app uses.
const MAXU = (1n << 256n) - 1n
function sqrtAtTick(tick) {
  const abs = BigInt(tick < 0 ? -tick : tick)
  let r = (abs & 0x1n) !== 0n ? 0xfffcb933bd6fad37aa2d162d1a594001n : 0x100000000000000000000000000000000n
  const M = [[0x2n,0xfff97272373d413259a46990580e213an],[0x4n,0xfff2e50f5f656932ef12357cf3c7fdccn],[0x8n,0xffe5caca7e10e4e61c3624eaa0941cd0n],[0x10n,0xffcb9843d60f6159c9db58835c926644n],[0x20n,0xff973b41fa98c081472e6896dfb254c0n],[0x40n,0xff2ea16466c96a3843ec78b326b52861n],[0x80n,0xfe5dee046a99a2a811c461f1969c3053n],[0x100n,0xfcbe86c7900a88aedcffc83b479aa3a4n],[0x200n,0xf987a7253ac413176f2b074cf7815e54n],[0x400n,0xf3392b0822b70005940c7a398e4b70f3n],[0x800n,0xe7159475a2c29b7443b29c7fa6e889d9n],[0x1000n,0xd097f3bdfd2022b8845ad8f792aa5825n],[0x2000n,0xa9f746462d870fdf8a65dc1f90e061e5n],[0x4000n,0x70d869a156d2a1b890bb3df62baf32f7n],[0x8000n,0x31be135f97d08fd981231505542fcfa6n],[0x10000n,0x9aa508b5b7a84e1c677de54f3e99bc9n],[0x20000n,0x5d6af8dedb81196699c329225ee604n],[0x40000n,0x2216e584f5fa1ea926041bedfe98n],[0x80000n,0x48a170391f7dc42444e8fa2n]]
  for (const [b, m] of M) if ((abs & b) !== 0n) r = (r * m) >> 128n
  if (tick > 0) r = MAXU / r
  return (r >> 32n) + ((r % (1n << 32n)) === 0n ? 0n : 1n)
}
const SQRT_PRICE_X96 = sqrtAtTick(CURRENT_TICK)

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
const NPM_ABI = parseAbi([
  'function balanceOf(address) view returns (uint256)',
  'function tokenOfOwnerByIndex(address,uint256) view returns (uint256)',
  'function positions(uint256) view returns (uint96,address,address,address,uint24,int24,int24,uint128,uint256,uint256,uint128,uint128)'
])

const FACTORY_ABI = parseAbi(['function getPool(address,address,uint24) view returns (address)'])

const POOL_ABI = parseAbi([
  'function slot0() view returns (uint160,int24,uint16,uint16,uint16,uint8,bool)',
  'function liquidity() view returns (uint128)',
  'function feeGrowthGlobal0X128() view returns (uint256)',
  'function feeGrowthGlobal1X128() view returns (uint256)',
  'function ticks(int24) view returns (uint128,int128,uint256,uint256,int56,uint160,uint32,bool)'
])

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

function callNpm(data) {
  const { functionName, args } = decodeFunctionData({ abi: NPM_ABI, data })
  if (functionName === 'balanceOf') {
    return encodeFunctionResult({ abi: NPM_ABI, functionName, result: args[0].toLowerCase() === OWNER ? 1n : 0n })
  }
  if (functionName === 'tokenOfOwnerByIndex') {
    if (args[0].toLowerCase() !== OWNER || args[1] !== 0n) throw new Error('index out of bounds')
    return encodeFunctionResult({ abi: NPM_ABI, functionName, result: POSITION.tokenId })
  }
  if (functionName === 'positions') {
    if (args[0] !== POSITION.tokenId) throw new Error('invalid token id')
    return encodeFunctionResult({
      abi: NPM_ABI, functionName,
      result: [
        0n, '0x0000000000000000000000000000000000000000',
        POSITION.token0, POSITION.token1, POSITION.fee,
        POSITION.tickLower, POSITION.tickUpper, POSITION.liquidity,
        POSITION.feeGrowthInside0Last, POSITION.feeGrowthInside1Last,
        POSITION.tokensOwed0, POSITION.tokensOwed1
      ]
    })
  }
  throw new Error(`unsupported NPM function ${functionName}`)
}

function callFactory(data) {
  const { functionName } = decodeFunctionData({ abi: FACTORY_ABI, data })
  return encodeFunctionResult({ abi: FACTORY_ABI, functionName, result: POOL })
}

function callPool(data) {
  const { functionName, args } = decodeFunctionData({ abi: POOL_ABI, data })
  switch (functionName) {
    case 'slot0':
      return encodeFunctionResult({ abi: POOL_ABI, functionName, result: [SQRT_PRICE_X96, CURRENT_TICK, 0, 1, 1, 0, true] })
    case 'liquidity':
      return encodeFunctionResult({ abi: POOL_ABI, functionName, result: 900000000n })
    case 'feeGrowthGlobal0X128':
      return encodeFunctionResult({ abi: POOL_ABI, functionName, result: FEE_GROWTH_GLOBAL_0 })
    case 'feeGrowthGlobal1X128':
      return encodeFunctionResult({ abi: POOL_ABI, functionName, result: FEE_GROWTH_GLOBAL_1 })
    case 'ticks':
      // Both bounds initialised with zero growth outside, so feeGrowthInside
      // reduces to the global accumulator while the price sits in range.
      if (args[0] !== POSITION.tickLower && args[0] !== POSITION.tickUpper) throw new Error('tick not initialised')
      return encodeFunctionResult({ abi: POOL_ABI, functionName, result: [POSITION.liquidity, 0n, 0n, 0n, 0n, 0n, 0, true] })
    default:
      throw new Error(`unsupported pool function ${functionName}`)
  }
}

function callToken(target, data) {
  const t = target.toLowerCase()
  if (t === MULTICALL3) return callMulticallHelper(data)
  if (t === NPM) return callNpm(data)
  if (t === FACTORY) return callFactory(data)
  if (t === POOL) return callPool(data)

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
    case 'eth_getLogs':
      return handleLogs(params)
    case 'eth_gasPrice':
      return '0x5f5e100'
    default:
      throw new Error(`unsupported method ${method}`)
  }
}

const TOPIC_INCREASE = '0x3067048beee31b25b2f1681f88dac838c8bba36af25bfb2b7cf7473a5847e35f'
const TOPIC_COLLECT = '0x40d0efd1a53d60ecbf40971b9daf7dc90178c3aadc7aab1765632738fa8b8f01'
const hex32 = (v) => v.toString(16).padStart(64, '0')

/** Lifecycle logs for the fixture position: one mint, one fee collection. */
function handleLogs(params) {
  const [filter] = params
  const topic0 = filter.topics && filter.topics[0]
  const idTopic = '0x' + hex32(POSITION.tokenId)
  if (filter.topics && filter.topics[1] && filter.topics[1].toLowerCase() !== idTopic) return []

  if (topic0 === TOPIC_INCREASE) {
    return [{
      address: NPM, blockNumber: '0x2000000', transactionHash: '0x' + 'a1'.repeat(32),
      topics: [TOPIC_INCREASE, idTopic],
      // liquidity, amount0 (95.06 USDC), amount1 (0.00137 cbBTC)
      data: '0x' + hex32(POSITION.liquidity) + hex32(95_060_000n) + hex32(137_000n)
    }]
  }
  if (topic0 === TOPIC_COLLECT) {
    return [{
      address: NPM, blockNumber: '0x2050000', transactionHash: '0x' + 'b2'.repeat(32),
      topics: [TOPIC_COLLECT, idTopic],
      // recipient, amount0 (5.38 USDC), amount1 (0.00001 cbBTC)
      data: '0x' + hex32(BigInt(OWNER)) + hex32(5_380_000n) + hex32(1_000n)
    }]
  }
  return []
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
  // The standalone HTML file is opened from file://, which sends Origin: null.
  // Permissive CORS is fine here and only here: this double serves fixtures.
  res.setHeader('access-control-allow-origin', '*')
  res.setHeader('access-control-allow-headers', 'content-type')
  if (req.method === 'OPTIONS') { res.writeHead(204).end(); return }

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
