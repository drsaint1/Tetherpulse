import WDK from '@tetherto/wdk';
import { encrypt, decrypt, type EncryptedData } from '../utils/crypto';
import { getEnv } from '../config/env';
import { createLogger } from '../utils/logger';

const log = createLogger('seed-vault');

export interface SeedData {
  encryptedSeed: string;
  seedIv: string;
  seedAuthTag: string;
}

export class SeedVault {
  private encryptionKey: string;

  constructor() {
    this.encryptionKey = getEnv().WDK_SEED_ENCRYPTION_KEY;
  }

  generateSeed(): string {
    // Use WDK's built-in 24-word seed phrase generation
    return WDK.getRandomSeedPhrase();
  }

  encryptSeed(seed: string): SeedData {
    const encrypted = encrypt(seed, this.encryptionKey);
    log.debug('Seed encrypted successfully');
    return {
      encryptedSeed: encrypted.ciphertext,
      seedIv: encrypted.iv,
      seedAuthTag: encrypted.authTag,
    };
  }

  decryptSeed(data: SeedData): string {
    const encrypted: EncryptedData = {
      ciphertext: data.encryptedSeed,
      iv: data.seedIv,
      authTag: data.seedAuthTag,
    };
    const seed = decrypt(encrypted, this.encryptionKey);
    log.debug('Seed decrypted successfully');
    return seed;
  }
}

export const seedVault = new SeedVault();
