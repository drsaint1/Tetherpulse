import type { InlineButton } from '../types';

export function toTelegramButtons(buttons: InlineButton[]) {
  return {
    reply_markup: {
      inline_keyboard: buttons.map(b => [{
        text: b.label,
        callback_data: b.callbackData,
      }]),
    },
  };
}

export function helpText(): string {
  return `🤖 *TetherPulse — AI Community Health Agent*

*Tipping:*
/tip @user 5 USDT — Send a tip
/tip @user 0.01 XAUT — Send gold tip
React 💰 to any message to tip!

*Wallet & Yield:*
/start — Register & create wallet
/balance — Check balances & deposit addresses
/faucet — Get testnet wallet info & faucet links
/faucet mint — Mint 100 free test USDT
/yield — View yield dashboard (Aave V3)
/yield deposit 10 polygon — Earn ~4-5% APY
/yield withdraw 10 polygon — Withdraw from Aave

*Bounties:*
/pool — List active bounties
/pool create "Fix bug" 10 USDT — Create bounty
/pool fund 1 5 — Fund pool #1
/pool claim 1 — Claim bounty #1

*Community:*
/leaderboard — Top tippers & receivers
/reputation — Score, streaks & badges
/pulse — Community health analytics
/autotip 1 USDT — Auto-tip contributors

*AI Features:*
• Natural language tipping — just say "tip @alice 5"
• AI detects quality contributions & suggests tips
• Auto-tip rules fire automatically
• Daily AI digest summarizes activity
• Cross-group portable reputation

*Supported Assets:*
• USDt — on TON, TRON, Polygon, Arbitrum
• XAU₮ — on Polygon, Arbitrum

Tips routed via cheapest chain automatically.
Idle USDT earns yield via Aave V3.`;
}
