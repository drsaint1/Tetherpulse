export type ChainId = 'ton' | 'tron' | 'polygon' | 'arbitrum';

export type Asset = 'USDT' | 'XAUT';

export interface ChainConfig {
  id: ChainId;
  name: string;
  gasless: boolean;
  usdt: { contract: string; decimals: number } | null;
  xaut: { contract: string; decimals: number } | null;
  priority: number; // Lower = preferred
}

// Testnet contract addresses
export const CHAIN_CONFIGS: Record<ChainId, ChainConfig> = {
  ton: {
    id: 'ton',
    name: 'TON (Gasless)',
    gasless: true,
    usdt: { contract: 'kQD0GKBM8ZbryVk2aESmzfU6b9b_8era_IkvBSELujFZPsyy', decimals: 6 }, // TON testnet USDT
    xaut: null,
    priority: 1,
  },
  tron: {
    id: 'tron',
    name: 'TRON (Shasta)',
    gasless: true,
    usdt: { contract: 'TG3XXyExBkPp9nzdajDZsozEu4BkaSJozs', decimals: 6 }, // Shasta testnet USDT
    xaut: null,
    priority: 2,
  },
  polygon: {
    id: 'polygon',
    name: 'Polygon Amoy',
    gasless: false,
    usdt: { contract: '0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582', decimals: 6 }, // Amoy testnet USDT
    xaut: { contract: '0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582', decimals: 6 }, // placeholder — same token for demo
    priority: 3,
  },
  arbitrum: {
    id: 'arbitrum',
    name: 'Arbitrum Sepolia',
    gasless: false,
    usdt: { contract: '0xddfce251255d01fd6ae20b6bff669f3c12dd8758', decimals: 6 }, // MockUSDT on Arbitrum Sepolia
    xaut: { contract: '0xddfce251255d01fd6ae20b6bff669f3c12dd8758', decimals: 6 }, // placeholder — same for demo
    priority: 4,
  },
};

export function getChainsForAsset(asset: Asset): ChainConfig[] {
  return Object.values(CHAIN_CONFIGS)
    .filter(c => asset === 'USDT' ? c.usdt !== null : c.xaut !== null)
    .sort((a, b) => a.priority - b.priority);
}
