import { eq, and } from 'drizzle-orm';
import { getDb, schema } from '../db/client';
import { seedVault } from '../wallet/seed-vault';
import { wdkManager } from '../wallet/wdk-manager';
import { balanceChecker } from '../wallet/balance-checker';
import { CHAIN_CONFIGS, type ChainId, type Asset } from '../config/chains';
import { createLogger } from '../utils/logger';

const log = createLogger('wallet-service');

export interface UserWallet {
  userId: number;
  addresses: Map<ChainId, string>;
}

export class WalletService {
  /**
   * Get or create a wallet for a user. Returns the DB user ID and all chain addresses.
   */
  async getOrCreateWallet(platform: string, platformId: string, username: string): Promise<UserWallet> {
    const db = getDb();

    // Check if user already exists
    const existing = await db.query.users.findFirst({
      where: and(
        eq(schema.users.platform, platform),
        eq(schema.users.platformId, platformId),
      ),
    });

    if (existing) {
      const addresses = await this.getUserAddresses(existing.id);
      return { userId: existing.id, addresses };
    }

    // Create new wallet
    return this.createNewWallet(platform, platformId, username);
  }

  private async createNewWallet(platform: string, platformId: string, username: string): Promise<UserWallet> {
    const db = getDb();

    // Generate and encrypt seed
    const seed = seedVault.generateSeed();
    const seedData = seedVault.encryptSeed(seed);

    // Create user record
    const [user] = await db.insert(schema.users).values({
      platform,
      platformId,
      username,
      encryptedSeed: seedData.encryptedSeed,
      seedIv: seedData.seedIv,
      seedAuthTag: seedData.seedAuthTag,
    }).returning();

    // Generate addresses on all chains
    const addressMap = await wdkManager.createWallets(seed);

    // Store addresses
    const addressRecords = Array.from(addressMap.entries()).map(([chain, address]) => ({
      userId: user.id,
      chain,
      address,
      isDeployed: false,
    }));

    if (addressRecords.length > 0) {
      await db.insert(schema.walletAddresses).values(addressRecords);
    }

    log.info({ userId: user.id, platform, chains: addressRecords.length }, 'New wallet created');
    return { userId: user.id, addresses: addressMap };
  }

  async getUserAddresses(userId: number): Promise<Map<ChainId, string>> {
    const db = getDb();
    const addresses = await db.query.walletAddresses.findMany({
      where: eq(schema.walletAddresses.userId, userId),
    });

    const map = new Map<ChainId, string>();
    for (const addr of addresses) {
      map.set(addr.chain as ChainId, addr.address);
    }
    return map;
  }

  async getUserSeed(userId: number): Promise<string> {
    const db = getDb();
    const user = await db.query.users.findFirst({
      where: eq(schema.users.id, userId),
    });

    if (!user) throw new Error(`User ${userId} not found`);

    return seedVault.decryptSeed({
      encryptedSeed: user.encryptedSeed,
      seedIv: user.seedIv,
      seedAuthTag: user.seedAuthTag,
    });
  }

  async getBalances(userId: number, asset: Asset): Promise<{ chain: ChainId; balance: number; address: string }[]> {
    const seed = await this.getUserSeed(userId);
    const addresses = await this.getUserAddresses(userId);
    return balanceChecker.getBalances(seed, asset, addresses);
  }

  /**
   * Look up a user by platform + platformId
   */
  async findUser(platform: string, platformId: string) {
    const db = getDb();
    return db.query.users.findFirst({
      where: and(
        eq(schema.users.platform, platform),
        eq(schema.users.platformId, platformId),
      ),
    });
  }

  /**
   * Look up a user by username on a platform
   */
  async findUserByUsername(platform: string, username: string) {
    const db = getDb();
    return db.query.users.findFirst({
      where: and(
        eq(schema.users.platform, platform),
        eq(schema.users.username, username),
      ),
    });
  }
}

export const walletService = new WalletService();
