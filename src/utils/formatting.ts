import type { Asset } from '../config/chains';

export function formatAmount(amount: number, asset: Asset): string {
  if (asset === 'XAUT') {
    return `${amount.toFixed(4)} XAU₮`;
  }
  return `${amount.toFixed(2)} USDt`;
}

export function shortenAddress(address: string, chars = 6): string {
  if (address.length <= chars * 2 + 2) return address;
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}

export function formatUsd(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

export function escapeMarkdown(text: string): string {
  return text.replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, '\\$&');
}
