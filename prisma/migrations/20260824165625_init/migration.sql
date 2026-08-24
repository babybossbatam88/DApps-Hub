-- CreateEnum
CREATE TYPE "PositionStatus" AS ENUM ('ACTIVE', 'OUT_OF_RANGE', 'CLOSED', 'BURNED', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "RangeState" AS ENUM ('IN_RANGE_SAFE', 'NEAR_LOWER', 'NEAR_UPPER', 'OUT_BELOW', 'OUT_ABOVE', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "PriceSource" AS ENUM ('ONCHAIN_POOL', 'BINANCE', 'DERIVED', 'FIXTURE');

-- CreateEnum
CREATE TYPE "DataConfidence" AS ENUM ('VERY_LOW', 'LOW', 'MEDIUM', 'HIGHER');

-- CreateEnum
CREATE TYPE "FeeEventKind" AS ENUM ('ACCRUAL_OBSERVED', 'COLLECTED');

-- CreateEnum
CREATE TYPE "LifecycleEventType" AS ENUM ('CREATE_POSITION', 'ADD_LIQUIDITY', 'REMOVE_LIQUIDITY', 'COLLECT_FEES', 'REBALANCE', 'CLOSE_POSITION');

-- CreateEnum
CREATE TYPE "SnapshotGranularity" AS ENUM ('RAW', 'HOURLY', 'DAILY');

-- CreateEnum
CREATE TYPE "SyncJobKind" AS ENUM ('WALLET_BALANCES', 'POSITION_DISCOVERY', 'POSITION_VALUATION', 'FEE_SYNC', 'PRICE_SYNC', 'SNAPSHOT', 'BINANCE_ACCOUNT', 'ALERT_EVALUATION');

-- CreateEnum
CREATE TYPE "SyncJobStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCEEDED', 'PARTIAL', 'FAILED');

-- CreateEnum
CREATE TYPE "AlertType" AS ENUM ('NEAR_LOWER_BOUND', 'NEAR_UPPER_BOUND', 'OUT_OF_RANGE', 'FEES_THRESHOLD', 'FEE_APR_BELOW', 'LP_VS_HODL_BELOW', 'PRICE_MOVE', 'SYNC_FAILURE');

-- CreateEnum
CREATE TYPE "AlertChannel" AS ENUM ('IN_APP', 'EMAIL', 'TELEGRAM', 'WHATSAPP');

-- CreateEnum
CREATE TYPE "ConnectionStatus" AS ENUM ('PENDING', 'OK', 'ERROR', 'UNSAFE_PERMISSIONS', 'DISABLED');

-- CreateEnum
CREATE TYPE "TransactionStatus" AS ENUM ('SUCCESS', 'REVERTED', 'PENDING', 'UNKNOWN');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "displayName" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_settings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "nearEdgePercent" DECIMAL(18,8) NOT NULL DEFAULT 15,
    "criticalEdgePercent" DECIMAL(18,8) NOT NULL DEFAULT 5,
    "safeEdgePercent" DECIMAL(18,8) NOT NULL DEFAULT 20,
    "minPositionSizeUsd" DECIMAL(36,18) NOT NULL DEFAULT 500,
    "preferredCurrency" TEXT NOT NULL DEFAULT 'USD',
    "snapshotIntervalMins" INTEGER NOT NULL DEFAULT 15,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wallets" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "chainId" INTEGER NOT NULL,
    "address" TEXT NOT NULL,
    "label" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastSyncedAt" TIMESTAMP(3),
    "lastSyncError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wallets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wallet_balances" (
    "id" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "tokenId" TEXT NOT NULL,
    "rawAmount" DECIMAL(78,0) NOT NULL,
    "usdValue" DECIMAL(36,18),
    "blockNumber" BIGINT,
    "observedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wallet_balances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chains" (
    "chainId" INTEGER NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nativeSymbol" TEXT NOT NULL,
    "nativeDecimals" INTEGER NOT NULL DEFAULT 18,
    "explorerUrl" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chains_pkey" PRIMARY KEY ("chainId")
);

-- CreateTable
CREATE TABLE "protocols" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "protocols_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tokens" (
    "id" TEXT NOT NULL,
    "chainId" INTEGER NOT NULL,
    "address" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "decimals" INTEGER NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "isStablecoin" BOOLEAN NOT NULL DEFAULT false,
    "binanceSymbol" TEXT,
    "isProxyPriced" BOOLEAN NOT NULL DEFAULT false,
    "coingeckoId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pools" (
    "id" TEXT NOT NULL,
    "chainId" INTEGER NOT NULL,
    "protocolId" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "token0Id" TEXT NOT NULL,
    "token1Id" TEXT NOT NULL,
    "feeTier" INTEGER NOT NULL,
    "tickSpacing" INTEGER NOT NULL,
    "lastSqrtPriceX96" TEXT,
    "lastTick" INTEGER,
    "lastLiquidity" TEXT,
    "lastBlockNumber" BIGINT,
    "lastObservedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pools_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lp_positions" (
    "id" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "protocolId" TEXT NOT NULL,
    "chainId" INTEGER NOT NULL,
    "poolId" TEXT NOT NULL,
    "poolAddress" TEXT NOT NULL,
    "positionNftId" TEXT NOT NULL,
    "token0Id" TEXT NOT NULL,
    "token1Id" TEXT NOT NULL,
    "feeTier" INTEGER NOT NULL,
    "tickLower" INTEGER NOT NULL,
    "tickUpper" INTEGER NOT NULL,
    "entryTimestamp" TIMESTAMP(3) NOT NULL,
    "initialToken0" DECIMAL(78,0) NOT NULL,
    "initialToken1" DECIMAL(78,0) NOT NULL,
    "initialToken0PriceUsd" DECIMAL(36,18),
    "initialToken1PriceUsd" DECIMAL(36,18),
    "initialCapitalUsd" DECIMAL(36,18),
    "currentLiquidity" TEXT NOT NULL DEFAULT '0',
    "status" "PositionStatus" NOT NULL DEFAULT 'UNKNOWN',
    "rangeState" "RangeState" NOT NULL DEFAULT 'UNKNOWN',
    "lastSyncedAt" TIMESTAMP(3),
    "lastSyncError" TEXT,
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lp_positions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "position_entry_snapshots" (
    "id" TEXT NOT NULL,
    "positionId" TEXT NOT NULL,
    "entryTimestamp" TIMESTAMP(3) NOT NULL,
    "blockNumber" BIGINT,
    "txHash" TEXT,
    "token0RawAmount" DECIMAL(78,0) NOT NULL,
    "token1RawAmount" DECIMAL(78,0) NOT NULL,
    "token0Decimals" INTEGER NOT NULL,
    "token1Decimals" INTEGER NOT NULL,
    "token0PriceUsd" DECIMAL(36,18),
    "token1PriceUsd" DECIMAL(36,18),
    "token0PriceSource" "PriceSource",
    "token1PriceSource" "PriceSource",
    "token0PriceIsProxy" BOOLEAN NOT NULL DEFAULT false,
    "token1PriceIsProxy" BOOLEAN NOT NULL DEFAULT false,
    "initialCapitalUsd" DECIMAL(36,18),
    "sqrtPriceX96" TEXT,
    "tick" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "position_entry_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "position_snapshots" (
    "id" TEXT NOT NULL,
    "positionId" TEXT NOT NULL,
    "takenAt" TIMESTAMP(3) NOT NULL,
    "granularity" "SnapshotGranularity" NOT NULL DEFAULT 'RAW',
    "blockNumber" BIGINT,
    "sqrtPriceX96" TEXT,
    "tick" INTEGER,
    "price" DECIMAL(48,18),
    "amount0" DECIMAL(78,0) NOT NULL,
    "amount1" DECIMAL(78,0) NOT NULL,
    "uncollectedFees0" DECIMAL(78,0) NOT NULL DEFAULT 0,
    "uncollectedFees1" DECIMAL(78,0) NOT NULL DEFAULT 0,
    "positionValueUsd" DECIMAL(36,18),
    "uncollectedFeesUsd" DECIMAL(36,18),
    "hodlValueUsd" DECIMAL(36,18),
    "lpVsHodlUsd" DECIMAL(36,18),
    "lpVsHodlPercent" DECIMAL(18,8),
    "divergenceExFeesUsd" DECIMAL(36,18),
    "rangeState" "RangeState" NOT NULL DEFAULT 'UNKNOWN',
    "source" "PriceSource" NOT NULL DEFAULT 'ONCHAIN_POOL',
    "isPending" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "position_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fee_events" (
    "id" TEXT NOT NULL,
    "positionId" TEXT NOT NULL,
    "kind" "FeeEventKind" NOT NULL,
    "amount0" DECIMAL(78,0) NOT NULL,
    "amount1" DECIMAL(78,0) NOT NULL,
    "usdValue" DECIMAL(36,18),
    "txHash" TEXT,
    "blockNumber" BIGINT,
    "observedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fee_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rebalance_events" (
    "id" TEXT NOT NULL,
    "positionId" TEXT NOT NULL,
    "type" "LifecycleEventType" NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "oldTickLower" INTEGER,
    "oldTickUpper" INTEGER,
    "newTickLower" INTEGER,
    "newTickUpper" INTEGER,
    "amount0" DECIMAL(78,0),
    "amount1" DECIMAL(78,0),
    "usdValue" DECIMAL(36,18),
    "feesCollected0" DECIMAL(78,0),
    "feesCollected1" DECIMAL(78,0),
    "feesCollectedUsd" DECIMAL(36,18),
    "gasCostUsd" DECIMAL(36,18),
    "reason" TEXT,
    "notes" TEXT,
    "transactionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rebalance_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" TEXT NOT NULL,
    "chainId" INTEGER NOT NULL,
    "txHash" TEXT NOT NULL,
    "blockNumber" BIGINT,
    "fromAddress" TEXT NOT NULL,
    "toAddress" TEXT,
    "gasUsed" DECIMAL(78,0),
    "gasPriceWei" DECIMAL(78,0),
    "gasCostUsd" DECIMAL(36,18),
    "methodSignature" TEXT,
    "status" "TransactionStatus" NOT NULL DEFAULT 'UNKNOWN',
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "positionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "price_snapshots" (
    "id" TEXT NOT NULL,
    "tokenId" TEXT NOT NULL,
    "priceUsd" DECIMAL(36,18) NOT NULL,
    "source" "PriceSource" NOT NULL,
    "isProxy" BOOLEAN NOT NULL DEFAULT false,
    "confidence" "DataConfidence" NOT NULL DEFAULT 'MEDIUM',
    "observedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "price_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "binance_connections" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "label" TEXT NOT NULL DEFAULT 'Binance',
    "apiKeyCiphertext" TEXT NOT NULL,
    "apiSecretCiphertext" TEXT NOT NULL,
    "encryptionIv" TEXT NOT NULL,
    "encryptionTag" TEXT NOT NULL,
    "keyVersion" INTEGER NOT NULL DEFAULT 1,
    "permissionsJson" JSONB,
    "readEnabled" BOOLEAN,
    "spotTradingEnabled" BOOLEAN,
    "withdrawalsEnabled" BOOLEAN,
    "ipRestricted" BOOLEAN,
    "status" "ConnectionStatus" NOT NULL DEFAULT 'PENDING',
    "lastCheckedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "binance_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alerts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "positionId" TEXT,
    "type" "AlertType" NOT NULL,
    "threshold" JSONB NOT NULL,
    "channel" "AlertChannel" NOT NULL DEFAULT 'IN_APP',
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "lastTriggeredAt" TIMESTAMP(3),
    "cooldownMinutes" INTEGER NOT NULL DEFAULT 60,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alert_deliveries" (
    "id" TEXT NOT NULL,
    "alertId" TEXT NOT NULL,
    "channel" "AlertChannel" NOT NULL,
    "message" TEXT NOT NULL,
    "contextJson" JSONB,
    "deliveredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" TIMESTAMP(3),

    CONSTRAINT "alert_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync_jobs" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "kind" "SyncJobKind" NOT NULL,
    "targetId" TEXT,
    "status" "SyncJobStatus" NOT NULL DEFAULT 'PENDING',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "itemsProcessed" INTEGER NOT NULL DEFAULT 0,
    "itemsFailed" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "detailsJson" JSONB,

    CONSTRAINT "sync_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "user_settings_userId_key" ON "user_settings"("userId");

-- CreateIndex
CREATE INDEX "wallets_userId_isActive_idx" ON "wallets"("userId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "wallets_userId_chainId_address_key" ON "wallets"("userId", "chainId", "address");

-- CreateIndex
CREATE INDEX "wallet_balances_walletId_idx" ON "wallet_balances"("walletId");

-- CreateIndex
CREATE UNIQUE INDEX "wallet_balances_walletId_tokenId_key" ON "wallet_balances"("walletId", "tokenId");

-- CreateIndex
CREATE UNIQUE INDEX "chains_key_key" ON "chains"("key");

-- CreateIndex
CREATE UNIQUE INDEX "protocols_key_key" ON "protocols"("key");

-- CreateIndex
CREATE INDEX "tokens_chainId_symbol_idx" ON "tokens"("chainId", "symbol");

-- CreateIndex
CREATE UNIQUE INDEX "tokens_chainId_address_key" ON "tokens"("chainId", "address");

-- CreateIndex
CREATE INDEX "pools_chainId_protocolId_idx" ON "pools"("chainId", "protocolId");

-- CreateIndex
CREATE UNIQUE INDEX "pools_chainId_address_key" ON "pools"("chainId", "address");

-- CreateIndex
CREATE INDEX "lp_positions_walletId_status_idx" ON "lp_positions"("walletId", "status");

-- CreateIndex
CREATE INDEX "lp_positions_poolId_idx" ON "lp_positions"("poolId");

-- CreateIndex
CREATE UNIQUE INDEX "lp_positions_chainId_protocolId_positionNftId_key" ON "lp_positions"("chainId", "protocolId", "positionNftId");

-- CreateIndex
CREATE UNIQUE INDEX "position_entry_snapshots_positionId_key" ON "position_entry_snapshots"("positionId");

-- CreateIndex
CREATE INDEX "position_snapshots_positionId_takenAt_idx" ON "position_snapshots"("positionId", "takenAt" DESC);

-- CreateIndex
CREATE INDEX "position_snapshots_granularity_takenAt_idx" ON "position_snapshots"("granularity", "takenAt" DESC);

-- CreateIndex
CREATE INDEX "fee_events_positionId_observedAt_idx" ON "fee_events"("positionId", "observedAt" DESC);

-- CreateIndex
CREATE INDEX "fee_events_positionId_kind_idx" ON "fee_events"("positionId", "kind");

-- CreateIndex
CREATE INDEX "rebalance_events_positionId_occurredAt_idx" ON "rebalance_events"("positionId", "occurredAt" DESC);

-- CreateIndex
CREATE INDEX "transactions_positionId_occurredAt_idx" ON "transactions"("positionId", "occurredAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "transactions_chainId_txHash_key" ON "transactions"("chainId", "txHash");

-- CreateIndex
CREATE INDEX "price_snapshots_tokenId_observedAt_idx" ON "price_snapshots"("tokenId", "observedAt" DESC);

-- CreateIndex
CREATE INDEX "binance_connections_userId_idx" ON "binance_connections"("userId");

-- CreateIndex
CREATE INDEX "alerts_userId_isEnabled_idx" ON "alerts"("userId", "isEnabled");

-- CreateIndex
CREATE INDEX "alerts_positionId_idx" ON "alerts"("positionId");

-- CreateIndex
CREATE INDEX "alert_deliveries_alertId_deliveredAt_idx" ON "alert_deliveries"("alertId", "deliveredAt" DESC);

-- CreateIndex
CREATE INDEX "sync_jobs_status_startedAt_idx" ON "sync_jobs"("status", "startedAt" DESC);

-- CreateIndex
CREATE INDEX "sync_jobs_kind_startedAt_idx" ON "sync_jobs"("kind", "startedAt" DESC);

-- AddForeignKey
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_chainId_fkey" FOREIGN KEY ("chainId") REFERENCES "chains"("chainId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_balances" ADD CONSTRAINT "wallet_balances_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "wallets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_balances" ADD CONSTRAINT "wallet_balances_tokenId_fkey" FOREIGN KEY ("tokenId") REFERENCES "tokens"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tokens" ADD CONSTRAINT "tokens_chainId_fkey" FOREIGN KEY ("chainId") REFERENCES "chains"("chainId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pools" ADD CONSTRAINT "pools_chainId_fkey" FOREIGN KEY ("chainId") REFERENCES "chains"("chainId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pools" ADD CONSTRAINT "pools_protocolId_fkey" FOREIGN KEY ("protocolId") REFERENCES "protocols"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pools" ADD CONSTRAINT "pools_token0Id_fkey" FOREIGN KEY ("token0Id") REFERENCES "tokens"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pools" ADD CONSTRAINT "pools_token1Id_fkey" FOREIGN KEY ("token1Id") REFERENCES "tokens"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lp_positions" ADD CONSTRAINT "lp_positions_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "wallets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lp_positions" ADD CONSTRAINT "lp_positions_protocolId_fkey" FOREIGN KEY ("protocolId") REFERENCES "protocols"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lp_positions" ADD CONSTRAINT "lp_positions_chainId_fkey" FOREIGN KEY ("chainId") REFERENCES "chains"("chainId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lp_positions" ADD CONSTRAINT "lp_positions_poolId_fkey" FOREIGN KEY ("poolId") REFERENCES "pools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lp_positions" ADD CONSTRAINT "lp_positions_token0Id_fkey" FOREIGN KEY ("token0Id") REFERENCES "tokens"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lp_positions" ADD CONSTRAINT "lp_positions_token1Id_fkey" FOREIGN KEY ("token1Id") REFERENCES "tokens"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "position_entry_snapshots" ADD CONSTRAINT "position_entry_snapshots_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "lp_positions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "position_snapshots" ADD CONSTRAINT "position_snapshots_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "lp_positions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fee_events" ADD CONSTRAINT "fee_events_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "lp_positions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rebalance_events" ADD CONSTRAINT "rebalance_events_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "lp_positions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rebalance_events" ADD CONSTRAINT "rebalance_events_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "lp_positions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_snapshots" ADD CONSTRAINT "price_snapshots_tokenId_fkey" FOREIGN KEY ("tokenId") REFERENCES "tokens"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "binance_connections" ADD CONSTRAINT "binance_connections_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "lp_positions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alert_deliveries" ADD CONSTRAINT "alert_deliveries_alertId_fkey" FOREIGN KEY ("alertId") REFERENCES "alerts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sync_jobs" ADD CONSTRAINT "sync_jobs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
