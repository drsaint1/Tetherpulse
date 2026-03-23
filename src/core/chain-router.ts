import { CHAIN_CONFIGS, getChainsForAsset, type ChainId, type Asset } from '../config/chains';
import { balanceChecker, type ChainBalance } from '../wallet/balance-checker';
import { wdkManager } from '../wallet/wdk-manager';
import { createLogger } from '../utils/logger';

const log = createLogger('chain-router');

export interface RouteResult {
  chain: ChainId;
  address: string;
  estimatedGasUsd: number;
  balance: number;
}

export class ChainRouter {
  /**
   * Find the cheapest chain to send a tip on.
   * Priority: gasless chains first (TON > TRON), then cheapest EVM chain.
   */
  async findBestRoute(
    seed: string,
    asset: Asset,
    amount: number,
    addresses: Map<ChainId, string>,
    recipientAddress?: string,
  ): Promise<RouteResult | null> {
    // Get balances on chains with sufficient funds
    const chainsWithBalance = await balanceChecker.getChainsWithSufficientBalance(
      seed, asset, amount, addresses,
    );

    if (chainsWithBalance.length === 0) {
      log.warn({ asset, amount }, 'No chain has sufficient balance');
      return null;
    }

    // Estimate gas on each chain with sufficient balance
    const routes: RouteResult[] = [];

    for (const chainBalance of chainsWithBalance) {
      const config = CHAIN_CONFIGS[chainBalance.chain];
      const tokenConfig = asset === 'USDT' ? config.usdt : config.xaut;
      if (!tokenConfig) continue;

      const amountRaw = Math.floor(amount * Math.pow(10, tokenConfig.decimals)).toString();
      const recipient = recipientAddress || chainBalance.address; // self for estimation
      const gasUsd = await wdkManager.estimateGas(seed, chainBalance.chain, tokenConfig.contract, recipient, amountRaw);

      routes.push({
        chain: chainBalance.chain,
        address: chainBalance.address,
        estimatedGasUsd: gasUsd,
        balance: chainBalance.balance,
      });
    }

    if (routes.length === 0) return null;

    // Sort by gas cost (ascending), then by chain priority
    routes.sort((a, b) => {
      if (a.estimatedGasUsd !== b.estimatedGasUsd) {
        return a.estimatedGasUsd - b.estimatedGasUsd;
      }
      return CHAIN_CONFIGS[a.chain].priority - CHAIN_CONFIGS[b.chain].priority;
    });

    const best = routes[0];
    log.info({
      chain: best.chain,
      gasUsd: best.estimatedGasUsd,
      alternatives: routes.length - 1,
    }, 'Best route selected');

    return best;
  }
}

export const chainRouter = new ChainRouter();
