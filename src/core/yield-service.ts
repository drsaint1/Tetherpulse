import { ethers } from 'ethers';
import { eq, and, sql } from 'drizzle-orm';
import { getDb, schema } from '../db/client';
import { walletService } from './wallet-service';
import { getEnv } from '../config/env';
import { CHAIN_CONFIGS, type ChainId } from '../config/chains';
import { createLogger } from '../utils/logger';

const log = createLogger('yield-service');

// Aave V3 Pool ABI — only what we need
const POOL_ABI = [
  'function supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode) external',
  'function withdraw(address asset, uint256 amount, address to) external returns (uint256)',
  'function getUserAccountData(address user) external view returns (uint256 totalCollateralBase, uint256 totalDebtBase, uint256 availableBorrowsBase, uint256 currentLiquidationThreshold, uint256 ltv, uint256 healthFactor)',
];

const ERC20_ABI = [
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function allowance(address owner, address spender) external view returns (uint256)',
  'function balanceOf(address account) external view returns (uint256)',
];

// Aave V3 Pool addresses (testnet)
const AAVE_POOLS: Partial<Record<ChainId, string>> = {
  arbitrum: '0x6Ae43d3271ff6888e7Fc43Fd7321a503ff738951', // Arbitrum Sepolia
  polygon: '0x794a61358D6845594F94dc1DB02A252b5b4814aD',   // Polygon Amoy (if deployed)
};

export class YieldService {
  /**
   * Deposit idle USDT into Aave V3 to earn yield
   */
  async deposit(userId: number, chain: ChainId, amount: number): Promise<{ success: boolean; message: string; txHash?: string }> {
    const poolAddress = AAVE_POOLS[chain];
    if (!poolAddress) {
      return { success: false, message: `Aave yield not available on ${CHAIN_CONFIGS[chain].name}` };
    }

    const tokenConfig = CHAIN_CONFIGS[chain].usdt;
    if (!tokenConfig) {
      return { success: false, message: `USDT not configured on ${chain}` };
    }

    try {
      const seed = await walletService.getUserSeed(userId);
      const wallet = this.getWallet(seed, chain);
      const amountRaw = ethers.parseUnits(amount.toString(), tokenConfig.decimals);

      // Approve USDT for Aave Pool
      const token = new ethers.Contract(tokenConfig.contract, ERC20_ABI, wallet);
      const allowance = await token.allowance(wallet.address, poolAddress);

      if (allowance < amountRaw) {
        const approveTx = await token.approve(poolAddress, ethers.MaxUint256);
        await approveTx.wait();
        log.info({ chain, txHash: approveTx.hash }, 'USDT approved for Aave');
      }

      // Supply to Aave
      const pool = new ethers.Contract(poolAddress, POOL_ABI, wallet);
      const supplyTx = await pool.supply(tokenConfig.contract, amountRaw, wallet.address, 0);
      await supplyTx.wait();

      // Record in DB
      const db = getDb();
      await db.insert(schema.yieldDeposits).values({
        userId,
        chain,
        amount: amount.toString(),
        aTokenBalance: amount.toString(),
        txHash: supplyTx.hash,
        status: 'deposited',
      });

      log.info({ userId, chain, amount, txHash: supplyTx.hash }, 'USDT deposited to Aave');

      return {
        success: true,
        message: `📈 Deposited ${amount} USDT into Aave V3 on ${CHAIN_CONFIGS[chain].name}!\nYour USDT is now earning ~4-5% APY.\nTX: \`${supplyTx.hash.slice(0, 10)}...${supplyTx.hash.slice(-6)}\``,
        txHash: supplyTx.hash,
      };
    } catch (error: any) {
      log.error({ error: error.message, userId, chain }, 'Aave deposit failed');
      return { success: false, message: `Yield deposit failed: ${error.shortMessage || error.message}` };
    }
  }

  /**
   * Withdraw USDT from Aave V3
   */
  async withdraw(userId: number, chain: ChainId, amount: number): Promise<{ success: boolean; message: string; txHash?: string }> {
    const poolAddress = AAVE_POOLS[chain];
    if (!poolAddress) {
      return { success: false, message: `Aave yield not available on ${CHAIN_CONFIGS[chain].name}` };
    }

    const tokenConfig = CHAIN_CONFIGS[chain].usdt;
    if (!tokenConfig) {
      return { success: false, message: `USDT not configured on ${chain}` };
    }

    try {
      const seed = await walletService.getUserSeed(userId);
      const wallet = this.getWallet(seed, chain);
      const amountRaw = ethers.parseUnits(amount.toString(), tokenConfig.decimals);

      const pool = new ethers.Contract(poolAddress, POOL_ABI, wallet);
      const withdrawTx = await pool.withdraw(tokenConfig.contract, amountRaw, wallet.address);
      await withdrawTx.wait();

      // Update DB
      const db = getDb();
      await db.update(schema.yieldDeposits)
        .set({ status: 'withdrawn', withdrawnAt: new Date() })
        .where(and(
          eq(schema.yieldDeposits.userId, userId),
          eq(schema.yieldDeposits.chain, chain),
          eq(schema.yieldDeposits.status, 'deposited'),
        ));

      log.info({ userId, chain, amount, txHash: withdrawTx.hash }, 'USDT withdrawn from Aave');

      return {
        success: true,
        message: `💰 Withdrew ${amount} USDT from Aave V3 on ${CHAIN_CONFIGS[chain].name}!\nTX: \`${withdrawTx.hash.slice(0, 10)}...${withdrawTx.hash.slice(-6)}\``,
        txHash: withdrawTx.hash,
      };
    } catch (error: any) {
      log.error({ error: error.message, userId, chain }, 'Aave withdrawal failed');
      return { success: false, message: `Yield withdrawal failed: ${error.shortMessage || error.message}` };
    }
  }

  /**
   * Auto-withdraw from Aave before a tip if wallet balance is insufficient
   */
  async autoWithdrawForTip(userId: number, chain: ChainId, neededAmount: number): Promise<boolean> {
    const db = getDb();
    const deposits = await db.select()
      .from(schema.yieldDeposits)
      .where(and(
        eq(schema.yieldDeposits.userId, userId),
        eq(schema.yieldDeposits.chain, chain),
        eq(schema.yieldDeposits.status, 'deposited'),
      ));

    const totalDeposited = deposits.reduce((sum, d) => sum + parseFloat(d.amount), 0);
    if (totalDeposited < neededAmount) return false;

    const result = await this.withdraw(userId, chain, neededAmount);
    return result.success;
  }

  /**
   * Get total yield earnings for a user
   */
  async getYieldInfo(userId: number): Promise<{ totalDeposited: number; chains: { chain: string; amount: number }[] }> {
    const db = getDb();
    const deposits = await db.select()
      .from(schema.yieldDeposits)
      .where(and(
        eq(schema.yieldDeposits.userId, userId),
        eq(schema.yieldDeposits.status, 'deposited'),
      ));

    const chains = deposits.map(d => ({
      chain: d.chain,
      amount: parseFloat(d.amount),
    }));

    return {
      totalDeposited: chains.reduce((sum, c) => sum + c.amount, 0),
      chains,
    };
  }

  /**
   * Get available chains for yield
   */
  getAvailableChains(): ChainId[] {
    return Object.keys(AAVE_POOLS) as ChainId[];
  }

  /**
   * Derive an ethers wallet from BIP-39 seed for direct contract interaction
   */
  private getWallet(seedPhrase: string, chain: ChainId): ethers.Wallet {
    const env = getEnv();
    const rpcUrl = chain === 'polygon' ? env.POLYGON_RPC_URL : env.ARBITRUM_RPC_URL;
    const provider = new ethers.JsonRpcProvider(rpcUrl);

    // Derive from seed using standard BIP-44 path
    const hdNode = ethers.HDNodeWallet.fromPhrase(seedPhrase, undefined, "m/44'/60'/0'/0/0");
    return new ethers.Wallet(hdNode.privateKey, provider);
  }
}

export const yieldService = new YieldService();
