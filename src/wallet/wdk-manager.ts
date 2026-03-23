import WDK from '@tetherto/wdk';
import WalletManagerEvm from '@tetherto/wdk-wallet-evm';
import WalletManagerTonGasless from '@tetherto/wdk-wallet-ton-gasless';
import WalletManagerTronGasfree from '@tetherto/wdk-wallet-tron-gasfree';
import { getEnv } from '../config/env';
import { createLogger } from '../utils/logger';
import type { ChainId } from '../config/chains';

const log = createLogger('wdk-manager');

export class WdkManager {
  private initialized = false;
  private enabledChains: ChainId[] = [];

  async initialize(): Promise<void> {
    if (this.initialized) return;

    const env = getEnv();

    // Determine which chains are configured
    this.enabledChains = ['polygon', 'arbitrum']; // EVM always available (defaults work)

    if (env.TON_PAYMASTER_ADDRESS) {
      this.enabledChains.push('ton');
      log.info('TON gasless chain enabled');
    }

    if (env.TRON_GASFREE_API_KEY && env.TRON_GASFREE_PROVIDER_URL) {
      this.enabledChains.push('tron');
      log.info('TRON gas-free chain enabled');
    }

    this.initialized = true;
    log.info({ chains: this.enabledChains }, 'WDK Manager initialized');
  }

  getEnabledChains(): ChainId[] {
    return this.enabledChains;
  }

  /**
   * Create a WDK instance for a user's seed phrase.
   * Only registers chains that have their env vars configured.
   */
  private createWdkInstance(seedPhrase: string): InstanceType<typeof WDK> {
    const env = getEnv();
    let wdk = new WDK(seedPhrase);

    // EVM chains — always registered (testnet RPCs work as defaults)
    wdk = wdk
      .registerWallet('polygon', WalletManagerEvm, {
        provider: env.POLYGON_RPC_URL,
        transferMaxFee: 100000000000000,
      })
      .registerWallet('arbitrum', WalletManagerEvm, {
        provider: env.ARBITRUM_RPC_URL,
        transferMaxFee: 100000000000000,
      });

    // TON — only if paymaster address is configured
    if (env.TON_PAYMASTER_ADDRESS) {
      wdk = wdk.registerWallet('ton', WalletManagerTonGasless, {
        tonClient: {
          url: env.TON_CENTER_URL,
          ...(env.TON_CENTER_API_KEY && { secretKey: env.TON_CENTER_API_KEY }),
        },
        tonApiClient: {
          url: env.TON_API_URL,
          ...(env.TON_API_KEY && { secretKey: env.TON_API_KEY }),
        },
        paymasterToken: {
          address: env.TON_PAYMASTER_ADDRESS,
        },
        transferMaxFee: 10000000,
      });
    }

    // TRON — only if gasfree credentials are configured
    if (env.TRON_GASFREE_API_KEY && env.TRON_GASFREE_PROVIDER_URL) {
      wdk = wdk.registerWallet('tron', WalletManagerTronGasfree, {
        chainId: 2494104990, // Shasta testnet chain ID
        provider: env.TRON_PROVIDER_URL,
        gasFreeProvider: env.TRON_GASFREE_PROVIDER_URL,
        gasFreeApiKey: env.TRON_GASFREE_API_KEY,
        gasFreeApiSecret: env.TRON_GASFREE_API_SECRET,
        serviceProvider: env.TRON_SERVICE_PROVIDER,
        verifyingContract: env.TRON_VERIFYING_CONTRACT,
        transferMaxFee: 10000000,
      });
    }

    return wdk;
  }

  /**
   * Create wallet addresses on all enabled chains for a given seed
   */
  async createWallets(seedPhrase: string): Promise<Map<ChainId, string>> {
    const addresses = new Map<ChainId, string>();
    const wdk = this.createWdkInstance(seedPhrase);

    await Promise.all(this.enabledChains.map(async (chain) => {
      try {
        const account = await wdk.getAccount(chain, 0);
        const address = await account.getAddress();
        addresses.set(chain, address);
        log.debug({ chain, address }, 'Wallet address generated');
      } catch (error) {
        log.error({ error, chain }, 'Failed to create wallet on chain');
      }
    }));

    log.info({ chainCount: addresses.size }, 'Wallets created for user');
    return addresses;
  }

  /**
   * Get token balance on a specific chain
   */
  async getBalance(seedPhrase: string, chain: ChainId, tokenContract: string): Promise<string> {
    try {
      const wdk = this.createWdkInstance(seedPhrase);
      const account = await wdk.getAccount(chain, 0);
      const balance = await account.getTokenBalance(tokenContract);
      log.debug({ chain, tokenContract, balance: balance.toString() }, 'Balance fetched');
      return balance.toString();
    } catch (error) {
      log.warn({ chain, tokenContract }, 'Balance fetch failed — returning 0');
      return '0';
    }
  }

  /**
   * Transfer tokens on a specific chain
   */
  async transfer(
    seedPhrase: string,
    chain: ChainId,
    to: string,
    amount: string,
    tokenContract: string,
  ): Promise<string> {
    log.info({ chain, to, amount }, 'Executing transfer');

    const wdk = this.createWdkInstance(seedPhrase);
    const account = await wdk.getAccount(chain, 0);

    const result = await account.transfer({
      token: tokenContract,
      recipient: to,
      amount: BigInt(amount),
    });

    log.info({ chain, hash: result.hash }, 'Transfer completed');
    return result.hash;
  }

  /**
   * Estimate gas cost for a transfer in USD (returns 0 for gasless chains)
   */
  async estimateGas(seedPhrase: string, chain: ChainId, tokenContract: string, to: string, amount: string): Promise<number> {
    if (chain === 'ton' || chain === 'tron') {
      return 0; // Gasless/gas-free chains
    }

    try {
      const wdk = this.createWdkInstance(seedPhrase);
      const account = await wdk.getAccount(chain, 0);

      const quote = await account.quoteTransfer({
        token: tokenContract,
        recipient: to,
        amount: BigInt(amount),
      });

      // Convert fee from wei to a rough USD estimate
      const feeWei = Number(quote.fee);
      const feeEth = feeWei / 1e18;
      const nativePrice = chain === 'polygon' ? 0.5 : 2000;
      return feeEth * nativePrice;
    } catch (error) {
      log.error({ error, chain }, 'Gas estimation failed');
      return chain === 'polygon' ? 0.01 : 0.05;
    }
  }
}

export const wdkManager = new WdkManager();
