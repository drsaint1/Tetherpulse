import { CHAIN_CONFIGS, type ChainId, type Asset } from '../config/chains';
import { wdkManager } from './wdk-manager';
import { createLogger } from '../utils/logger';

const log = createLogger('balance-checker');

export interface ChainBalance {
  chain: ChainId;
  balance: number;
  address: string;
}

export class BalanceChecker {
  /**
   * Get balance of an asset across all supported chains for a user
   */
  async getBalances(seed: string, asset: Asset, addresses: Map<ChainId, string>): Promise<ChainBalance[]> {
    const balances: ChainBalance[] = [];

    const checks = Array.from(addresses.entries()).map(async ([chain, address]) => {
      const config = CHAIN_CONFIGS[chain];
      const tokenConfig = asset === 'USDT' ? config.usdt : config.xaut;

      if (!tokenConfig) return;

      try {
        const rawBalance = await wdkManager.getBalance(seed, chain, tokenConfig.contract);
        const balance = parseFloat(rawBalance) / Math.pow(10, tokenConfig.decimals);

        balances.push({ chain, balance, address });
        log.debug({ chain, balance, asset }, 'Balance fetched');
      } catch (error) {
        log.error({ error, chain, asset }, 'Failed to fetch balance');
        balances.push({ chain, balance: 0, address });
      }
    });

    await Promise.all(checks);
    return balances.sort((a, b) => b.balance - a.balance);
  }

  /**
   * Get total balance of an asset across all chains
   */
  async getTotalBalance(seed: string, asset: Asset, addresses: Map<ChainId, string>): Promise<number> {
    const balances = await this.getBalances(seed, asset, addresses);
    return balances.reduce((sum, b) => sum + b.balance, 0);
  }

  /**
   * Find chains with sufficient balance for a given amount
   */
  async getChainsWithSufficientBalance(
    seed: string,
    asset: Asset,
    amount: number,
    addresses: Map<ChainId, string>,
  ): Promise<ChainBalance[]> {
    const balances = await this.getBalances(seed, asset, addresses);
    return balances.filter(b => b.balance >= amount);
  }
}

export const balanceChecker = new BalanceChecker();
