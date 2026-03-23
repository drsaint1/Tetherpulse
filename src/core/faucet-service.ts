import { ethers } from 'ethers';
import { walletService } from './wallet-service';
import { getEnv } from '../config/env';
import { CHAIN_CONFIGS, txLink, type ChainId } from '../config/chains';
import { createLogger } from '../utils/logger';

const log = createLogger('faucet-service');

// MockUSDT with public mint() on Arbitrum Sepolia
const MINTABLE_TOKENS: Partial<Record<ChainId, { contract: string; decimals: number; name: string }>> = {
  arbitrum: {
    contract: '0xddfce251255d01fd6ae20b6bff669f3c12dd8758',
    decimals: 6,
    name: 'MockUSDT',
  },
};

const MINT_ABI = [
  'function mint(address to, uint256 amount) external',
];

export class FaucetService {
  /**
   * Mint test USDT to a user's wallet on Arbitrum Sepolia.
   * The MockUSDT contract has a public mint() anyone can call.
   */
  async mintTestTokens(userId: number, chain: ChainId = 'arbitrum', amount: number = 100): Promise<string> {
    const mintable = MINTABLE_TOKENS[chain];
    if (!mintable) {
      return `No mintable test tokens available on ${CHAIN_CONFIGS[chain].name}.\n\n` +
        `Available: ${Object.keys(MINTABLE_TOKENS).map(c => c.toUpperCase()).join(', ')}`;
    }

    try {
      const seed = await walletService.getUserSeed(userId);
      const wallet = this.getWallet(seed, chain);
      const address = wallet.address;

      // Check if user has gas (native ETH)
      const gasBalance = await wallet.provider!.getBalance(address);
      if (gasBalance === 0n) {
        return `⛽ You need testnet ETH for gas first!\n\n` +
          `Your ${chain.toUpperCase()} wallet: \`${address}\`\n\n` +
          `Get free testnet ETH:\n` +
          `• [Alchemy Faucet](https://www.alchemy.com/faucets/arbitrum-sepolia)\n` +
          `• [QuickNode Faucet](https://faucet.quicknode.com/arbitrum/sepolia)\n` +
          `• [Chainlink Faucet](https://faucets.chain.link/arbitrum-sepolia)\n\n` +
          `Copy your wallet address above, paste it in any faucet, then run \`/faucet\` again.`;
      }

      // Mint test USDT
      const contract = new ethers.Contract(mintable.contract, MINT_ABI, wallet);
      const amountRaw = ethers.parseUnits(amount.toString(), mintable.decimals);

      const tx = await contract.mint(address, amountRaw);
      const receipt = await tx.wait();

      log.info({ userId, chain, amount, txHash: receipt.hash }, 'Test tokens minted');

      return `✅ *${amount} Test USDT Minted!*\n\n` +
        `${amount} ${mintable.name} → your wallet\n` +
        `Chain: ${CHAIN_CONFIGS[chain].name}\n` +
        `TX: ${txLink(chain, receipt.hash)}\n\n` +
        `You can now send tips! Try:\n` +
        `\`/tip @username 5 USDT\``;
    } catch (error: any) {
      log.error({ error: error.message, userId, chain }, 'Faucet mint failed');

      if (error.message?.includes('insufficient funds')) {
        const seed = await walletService.getUserSeed(userId);
        const wallet = this.getWallet(seed, chain);
        return `⛽ Not enough testnet ETH for gas!\n\n` +
          `Your wallet: \`${wallet.address}\`\n\n` +
          `Get free ETH: https://www.alchemy.com/faucets/arbitrum-sepolia`;
      }

      return `Mint failed: ${error.shortMessage || error.message}`;
    }
  }

  /**
   * Get wallet info for faucet funding
   */
  async getWalletInfo(userId: number): Promise<string> {
    const addresses = await walletService.getUserAddresses(userId);

    let response = `💧 *Testnet Faucet*\n\n`;
    response += `Your wallet addresses:\n`;
    for (const [chain, address] of addresses) {
      response += `  ${chain.toUpperCase()}: \`${address}\`\n`;
    }

    response += `\n*Step 1:* Get testnet ETH for gas\n`;
    response += `• [Alchemy](https://www.alchemy.com/faucets/arbitrum-sepolia) — 0.1 ETH/day\n`;
    response += `• [QuickNode](https://faucet.quicknode.com/arbitrum/sepolia) — 0.01 ETH/12h\n`;
    response += `• [Chainlink](https://faucets.chain.link/arbitrum-sepolia)\n\n`;

    response += `*Step 2:* Mint test USDT\n`;
    response += `\`/faucet mint\` — mint 100 test USDT\n`;
    response += `\`/faucet mint 500\` — mint 500 test USDT\n\n`;

    response += `_Only Arbitrum Sepolia supported for testnet minting_`;

    return response;
  }

  private getWallet(seedPhrase: string, chain: ChainId): ethers.Wallet {
    const env = getEnv();
    const rpcUrl = chain === 'polygon' ? env.POLYGON_RPC_URL : env.ARBITRUM_RPC_URL;
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const hdNode = ethers.HDNodeWallet.fromPhrase(seedPhrase, undefined, "m/44'/60'/0'/0/0");
    return new ethers.Wallet(hdNode.privateKey, provider);
  }
}

export const faucetService = new FaucetService();
