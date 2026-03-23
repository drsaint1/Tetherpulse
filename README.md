# TetherPulse

**AI-powered community health agent that autonomously detects valuable contributions, executes multi-chain USDT/XAU₮ tips, earns yield on idle funds via Aave V3, and manages crowdfunded bounty pools — all through self-custodial WDK wallets.**

> Built for Hackathon Galactica: WDK Edition 1 | Track: Tipping Bot

---

## Demo

- **Live Bot:** [@TetherPulseBot](https://t.me/WDKTipbot)
- **Dashboard:** [TetherPulse Dashboard](https://tetherpulse.onrender.com) _(or `http://localhost:3000` locally)_
- **Demo Video:** [YouTube Link](#)

---

## What is TetherPulse?

TetherPulse is not a simple tipping bot. It is an **autonomous AI agent** that monitors Telegram communities, evaluates the economic value of member contributions using Google Gemini, and executes on-chain USDT/XAU₮ transfers through Tether WDK self-custodial wallets — routing every transaction through the cheapest available chain.

**The agent defines the rules. Humans contribute. Value settles on-chain.**

### The Problem

Community contributors — the people who answer questions, share resources, debug issues, and mentor newcomers — receive zero financial recognition. Manual tipping requires constant human attention and rarely happens in practice.

### The Solution

TetherPulse operates as an autonomous economic agent:

1. **Monitors** every message in the community using Google Gemini 2.0 Flash
2. **Scores** contribution quality (0-100) across categories: technical help, resource sharing, mentorship
3. **Suggests** or **auto-executes** USDT/XAU₮ tips when contributions score above threshold
4. **Routes** each tip through the cheapest chain (gasless TON/TRON preferred, then cheapest EVM)
5. **Deposits** idle wallet balances into Aave V3 to earn ~4-5% APY on USDT
6. **Manages** crowdfunded bounty pools for community-driven task rewards
7. **Tracks** reputation, streaks, badges, and community health metrics across all groups
8. **Generates** daily AI-powered community digests summarizing activity

No human triggers. No manual approvals for auto-tips. The agent does the work. Value settles on-chain.

---

## Architecture

```
Telegram Messages
       |
       v
  AI Service (Gemini 2.0 Flash)
       |
       +---> Tip Intent Parser -----> Tip Service -----> Chain Router
       |                                   |                   |
       +---> Contribution Scorer ----> Auto-Tip Engine         v
       |                                                  WDK Manager
       +---> Chat Reply Agent                                |
       |                                            +--------+--------+
       +---> Daily Digest (Cron)                    |        |        |
                                                  TON     TRON      EVM
                                               (gasless) (gas-free) (Polygon/Arbitrum)
                                                    |
                                                    v
                                             On-Chain Settlement
                                                    |
                                         +----------+----------+
                                         |                     |
                                   Aave V3 Yield         Bounty Pools
                                   (idle funds)        (crowdfunded tasks)
```

---

## Key Features

### 1. Autonomous AI Agent (Gemini 2.0 Flash)

| Feature | Description |
|---------|-------------|
| **Natural Language Tipping** | "tip @alice 5 for the help" — Gemini parses intent, executes on-chain transfer |
| **Contribution Scoring** | Every substantial message is scored 0-100 by AI across categories (technical help, mentoring, resource sharing) |
| **Auto-Tip Rules** | Users set standing orders: "auto-tip 2 USDT for any contribution scoring 70+" — fires without human approval |
| **Daily AI Digest** | Cron job generates community health summary and posts to channel at midnight |
| **Conversational Agent** | Bot replies intelligently to all messages using Gemini, not just commands |
| **Tip Suggestions** | AI detects high-value contributions and suggests tips with inline buttons |

### 2. Multi-Chain Smart Routing (Tether WDK)

| Chain | Type | Gas Cost | Assets | Network |
|-------|------|----------|--------|---------|
| TON | Gasless (paymaster) | $0.00 | USDT | Testnet |
| TRON Shasta | Gas-free | $0.00 | USDT | Shasta |
| Polygon Amoy | EVM L2 | ~$0.01 | USDT, XAU₮ | Amoy |
| Arbitrum Sepolia | EVM L2 | ~$0.05 | USDT, XAU₮ | Sepolia |

The chain router automatically selects the cheapest option with sufficient balance. Gasless chains (TON, TRON) are always preferred. If balance only exists on one chain, that chain is used regardless of gas cost.

**WDK Integration:**
- `WDK.getRandomSeedPhrase()` — generates 24-word BIP-39 mnemonic
- `wdk.registerWallet(name, Manager, config)` — registers chain-specific wallet managers
- `wdk.getAccount(chain, 0)` — derives account via BIP-44 path `m/44'/60'/0'/0/0`
- `account.transfer({ token, recipient, amount })` — executes on-chain ERC-20 transfer
- `account.getTokenBalance(contract)` — reads on-chain token balance
- `account.getAddress()` — returns derived wallet address

### 3. DeFi: Aave V3 Yield Generation

Idle USDT sitting in wallets earns yield through Aave V3 lending pools:

- Deposit idle USDT to Aave V3 on Polygon or Arbitrum
- Earns ~4-5% APY while waiting to be tipped
- Withdraw anytime with `/yield withdraw`
- Real on-chain `supply()` and `withdraw()` calls to Aave Pool contracts
- Deposits tracked in database with aToken balance monitoring

```
/yield                     — View yield dashboard (deposits, APY, earnings)
/yield deposit 10 polygon  — Deposit 10 USDT to Aave V3 on Polygon
/yield withdraw 10 polygon — Withdraw from Aave
```

### 4. Crowdfunded Bounty Pools

Community-driven task rewards funded by multiple members:

- Create a bounty for any community task
- Multiple members can fund the same pool
- Progress tracking with real-time totals
- Anyone can claim when the bounty is complete
- Pools expire after 7 days if not claimed

```
/pool                       — List active bounties
/pool create "Fix bug" 50   — Create a 50 USDT bounty pool
/pool fund 1 10             — Fund pool #1 with 10 USDT
/pool claim 1               — Claim bounty #1
```

### 5. Gamification: Streaks & Badges

| Badge | Requirement | Emoji |
|-------|-------------|-------|
| First Tip | Send your first tip | :star: |
| 3-Day Streak | Tip 3 consecutive days | :fire: |
| 7-Day Streak | Tip 7 consecutive days | :comet: |
| 30-Day Streak | Tip 30 consecutive days | :diamond: |
| 10 Tips | Send 10 total tips | :medal: |
| 50 Tips | Send 50 total tips | :trophy: |
| 100 Tips | Send 100 total tips | :crown: |
| Big Tipper | Single tip of $50+ | :moneybag: |
| Gold Tipper | Send an XAU₮ tip | :gold_bar: |

**Reputation Multiplier:** 1.0x base + 0.1x per consecutive streak day (caps at 3.0x). Higher multipliers boost your reputation score across all TetherPulse communities.

### 6. Self-Custodial WDK Wallets

- Every user gets a unique HD wallet derived via `@tetherto/wdk`
- 24-word BIP-39 seed phrases generated by WDK
- Seeds encrypted with **AES-256-GCM** before database storage (random IV per user)
- Private keys derived in-memory, never persisted
- BIP-44 derivation: `m/44'/60'/0'/0/0`
- Addresses generated on all enabled chains simultaneously

### 7. Testnet Faucet (Self-Service)

Built-in faucet for testing with real on-chain tokens:

```
/faucet              — View wallet address + faucet links for testnet ETH
/faucet mint         — Mint 100 free test USDT (Arbitrum Sepolia)
/faucet mint 500     — Mint custom amount
```

Calls the public `mint(address, amount)` function on the MockUSDT contract.

### 8. Abuse Prevention

| Protection | Rule |
|-----------|------|
| Self-tip blocking | Cannot tip yourself |
| Hourly rate limit | Max 20 tips/hour per user |
| Daily cap | Max 500 USDT/day per user |
| Circular detection | A <-> B > 3x in 24h triggers warning |
| New account cap | Max 10 USDT for first 24 hours |
| Dust prevention | Minimum 0.10 USDT / 0.0001 XAU₮ per tip |
| Pending tip system | Tips to unregistered users are held until they `/start` |

### 9. Cross-Group Portable Reputation

- Reputation scores, streaks, and badges persist across all TetherPulse-powered communities
- A user who earns a "7-Day Streak" badge in Group A carries that badge into Group B
- Leaderboards can be viewed globally or per-group

### 10. Web Dashboard & API

Real-time community health dashboard with auto-refresh:

- **Health Score** (0-100) with AI-generated summary
- **Tipping Activity** — 24h/7d metrics, volume, unique tippers/receivers
- **Aave V3 Yield** — Total deposited, depositor count, APY tracking
- **Active Bounties** — Pool count, total pooled amount, progress bars
- **Leaderboards** — Top contributors, most generous, most appreciated

**API Endpoints:**
```
GET /                           — Dashboard HTML (auto-refreshes every 30s)
GET /api/health                 — Health check
GET /api/pulse                  — Global community analytics
GET /api/pulse/:chatId          — Per-group analytics
GET /api/leaderboard/tippers    — Top tippers (JSON)
GET /api/leaderboard/receivers  — Top receivers (JSON)
GET /api/tips                   — Tip history (JSON)
GET /api/stats                  — Aggregate statistics (JSON)
```

---

## Bot Commands

### Tipping
```
/tip @user 5 USDT         — Send a tip (auto-routed to cheapest chain)
/tip @user 0.01 XAUT      — Send a gold tip (XAU₮)
"tip @alice 5 for help"   — Natural language (AI parses intent)
React 💰 to any message   — Reaction-based tipping
```

### Wallet & Faucet
```
/start                     — Register & create self-custodial WDK wallet
/balance                   — Check USDT/XAU₮ balances across all chains
/faucet                    — Get wallet address + testnet ETH faucet links
/faucet mint               — Mint 100 free test USDT (Arbitrum Sepolia)
/faucet mint 500           — Mint custom amount of test USDT
```

### DeFi (Aave V3)
```
/yield                     — View yield dashboard (deposits, APY, earnings)
/yield deposit 10 polygon  — Deposit 10 USDT to Aave V3
/yield withdraw 10 polygon — Withdraw USDT from Aave
```

### Bounty Pools
```
/pool                      — List active bounties with progress bars
/pool create "desc" 10     — Create a 10 USDT bounty pool
/pool fund 1 5             — Fund pool #1 with 5 USDT
/pool claim 1              — Claim completed bounty #1
```

### Community & Reputation
```
/leaderboard               — Top tippers & receivers (global or per-group)
/reputation                — Your score, streak, badges & multiplier
/pulse                     — Community health analytics (AI-generated)
/autotip 1 USDT            — Auto-tip quality contributions (score >= 70)
/help                      — Full command reference
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Wallets** | `@tetherto/wdk` + `wdk-wallet-evm` + `wdk-wallet-ton-gasless` + `wdk-wallet-tron-gasfree` |
| **AI** | Google Gemini 2.0 Flash (`@google/generative-ai`) |
| **DeFi** | Aave V3 Pool contracts via `ethers.js` (Polygon Amoy / Arbitrum Sepolia) |
| **Bot** | Telegraf v4 (Telegram Bot API) |
| **API** | Fastify v5 + HTML dashboard |
| **Database** | PostgreSQL (Supabase) + Drizzle ORM |
| **Runtime** | Node.js 18+ / TypeScript 5.7 |
| **Scheduling** | node-cron (daily AI digest) |
| **Security** | AES-256-GCM seed encryption, Zod schema validation |
| **Logging** | Pino (structured JSON logging) |

---

## Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL database ([Supabase](https://supabase.com) free tier works)
- Telegram bot token (from [@BotFather](https://t.me/BotFather))
- Google Gemini API key (from [AI Studio](https://aistudio.google.com/apikey))

### 1. Clone and Install
```bash
git clone https://github.com/YOUR_USERNAME/tetherpulse.git
cd tetherpulse
npm install
```

### 2. Configure Environment
```bash
cp .env.example .env
```

Edit `.env` with your keys (only 4 required):
```env
DATABASE_URL=postgresql://postgres:password@db.xxx.supabase.co:5432/postgres
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
GEMINI_API_KEY=your_gemini_api_key
WDK_SEED_ENCRYPTION_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
```

### 3. Setup Database
```bash
npm run db:push
```

### 4. Run
```bash
# Development (hot reload)
npm run dev

# Production
npm run build && npm start
```

The bot starts on Telegram and the dashboard is available at `http://localhost:3000/`.

---

## Deployment

### Recommended: Railway

[Railway](https://railway.app) is the simplest option — deploy from GitHub with zero config:

1. **Push to GitHub:**
   ```bash
   git init && git add -A && git commit -m "initial commit"
   gh repo create tetherpulse --public --push
   ```

2. **Create Railway project:**
   - Go to [railway.app](https://railway.app) and sign in with GitHub
   - Click **"New Project"** → **"Deploy from GitHub Repo"**
   - Select your `tetherpulse` repo

3. **Add environment variables:**
   In the Railway dashboard, go to **Variables** and add:
   ```
   DATABASE_URL=postgresql://...
   TELEGRAM_BOT_TOKEN=...
   GEMINI_API_KEY=...
   WDK_SEED_ENCRYPTION_KEY=...
   PORT=3000
   NODE_ENV=production
   ```

4. **Set build command:**
   Railway auto-detects Node.js. If needed, set:
   - Build: `npm install && npm run build`
   - Start: `npm start`

5. **Done.** Railway gives you a public URL for the dashboard (e.g., `https://tetherpulse.up.railway.app`).

### Alternative: Render

[Render](https://render.com) offers a free tier with auto-deploy:

1. Connect your GitHub repo at [render.com](https://render.com)
2. Create a **Web Service** with:
   - Build: `npm install && npm run build`
   - Start: `npm start`
3. Add environment variables in the Render dashboard
4. Render provides a public URL (e.g., `https://tetherpulse.onrender.com`)

### Alternative: VPS (DigitalOcean / Hetzner)

For full control, deploy on a $5/mo VPS:

```bash
# On the VPS
git clone https://github.com/YOUR_USERNAME/tetherpulse.git
cd tetherpulse
npm install && npm run build
cp .env.example .env  # edit with your keys

# Run with PM2
npm install -g pm2
pm2 start dist/index.js --name tetherpulse
pm2 save && pm2 startup
```

---

## Testing Real Transactions

TetherPulse runs on testnets. Here's how to test real on-chain transfers:

### Step 1: Create Your Wallet
Open the bot on Telegram and send `/start`. This creates your WDK wallet with addresses on all enabled chains.

### Step 2: Get Testnet ETH (for gas)
Run `/faucet` to see your wallet address, then get free testnet ETH:
- [Alchemy Faucet](https://www.alchemy.com/faucets/arbitrum-sepolia) — 0.1 ETH/day
- [QuickNode Faucet](https://faucet.quicknode.com/arbitrum/sepolia)
- [Chainlink Faucet](https://faucets.chain.link/arbitrum-sepolia)

### Step 3: Mint Test USDT
```
/faucet mint        — Mints 100 test USDT to your wallet
/faucet mint 1000   — Mints 1000 test USDT
```
This calls the MockUSDT contract's public `mint()` function on Arbitrum Sepolia.

### Step 4: Verify Balance
```
/balance            — Shows USDT balance across all chains
```

### Step 5: Send a Tip
Have another user `/start` on the bot, then:
```
/tip @username 5 USDT
```
The WDK signs and broadcasts the ERC-20 transfer. You'll see the transaction hash in the receipt.

### Step 6: Try Yield
```
/yield deposit 10 arbitrum   — Deposits 10 USDT to Aave V3
/yield                       — Check yield dashboard
```

### Step 7: Create a Bounty
```
/pool create "Write a tutorial" 20   — Create a 20 USDT bounty
/pool fund 1 10                      — Fund pool #1
```

### Step 8: Check Reputation
```
/reputation                  — View your streak, badges, and multiplier
/leaderboard                 — See community rankings
```

### Testnet Contracts
| Chain | Token | Contract | Type |
|-------|-------|----------|------|
| Arbitrum Sepolia | MockUSDT | `0xddfce251255d01fd6ae20b6bff669f3c12dd8758` | Mintable ERC-20 (6 decimals) |
| Polygon Amoy | USDC (test) | `0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582` | Circle Fiat Token proxy |
| Arbitrum Sepolia | Aave V3 Pool | `0x6Ae43d3271ff6888e7Fc43Fd7321a503ff738951` | Lending pool |
| Polygon Amoy | Aave V3 Pool | `0x794a61358D6845594F94dc1DB02A252b5b4814aD` | Lending pool |

---

## Database Schema

11 tables in the `tipbot` PostgreSQL schema:

| Table | Purpose |
|-------|---------|
| `users` | User accounts with AES-256-GCM encrypted WDK seeds |
| `wallet_addresses` | Multi-chain addresses per user (TON, TRON, Polygon, Arbitrum) |
| `tips` | Tip history with tx hash, chain, gas cost, status, AI-suggested flag |
| `contribution_scores` | AI-scored message quality (0-100) with category |
| `auto_tip_rules` | Standing auto-tip configurations per user per chat |
| `yield_deposits` | Aave V3 deposit/withdrawal tracking with aToken balances |
| `tip_pools` | Bounty pool definitions with target amount and status |
| `pool_contributions` | Individual pool funding records |
| `tip_streaks` | Daily streak tracking, badge awards, reputation multiplier |
| `rate_limits` | Per-user hourly/daily rate limit counters |
| `daily_digests` | AI-generated community digest history |

---

## Project Structure

```
tetherpulse/
├── src/
│   ├── index.ts                 # Entry point — starts bot, API, cron
│   ├── config/
│   │   ├── env.ts               # Zod environment validation (4 required keys)
│   │   └── chains.ts            # Chain configs (4 chains, 2 assets, contracts)
│   ├── adapters/
│   │   └── telegram/
│   │       ├── bot.ts           # Telegraf setup + 12 command registrations
│   │       ├── handlers.ts      # Command handlers + NLP routing + reactions
│   │       └── formatters.ts    # Markdown formatting + help text
│   ├── core/
│   │   ├── engine.ts            # Central orchestrator (~550 lines)
│   │   ├── tip-service.ts       # Tip validation → route → WDK transfer → DB
│   │   ├── wallet-service.ts    # User registration + WDK wallet management
│   │   ├── ai-service.ts        # Gemini: NLP parsing + scoring + digest + chat
│   │   ├── chain-router.ts      # Multi-chain gas comparison + route selection
│   │   ├── yield-service.ts     # Aave V3 deposit/withdraw via ethers.js
│   │   ├── pool-service.ts      # Crowdfunded bounty pool CRUD
│   │   ├── streak-service.ts    # TipStreaks + 9 badges + reputation multiplier
│   │   ├── faucet-service.ts    # MockUSDT mint() on Arbitrum Sepolia
│   │   ├── autotip-service.ts   # Autonomous tip rule execution
│   │   ├── pulse-service.ts     # Community health metrics aggregation
│   │   ├── leaderboard-service.ts # Rankings: top tippers/receivers
│   │   ├── digest-service.ts    # Daily AI community summary (cron)
│   │   ├── abuse-guard.ts       # Rate limiting + fraud detection (7 checks)
│   │   └── cron.ts              # Scheduled jobs (daily digest, streak reset)
│   ├── wallet/
│   │   ├── wdk-manager.ts       # WDK init: registerWallet() for 4 chains
│   │   ├── seed-vault.ts        # AES-256-GCM seed encryption/decryption
│   │   └── balance-checker.ts   # Cross-chain token balance aggregation
│   ├── db/
│   │   ├── schema.ts            # Drizzle schema (11 tables)
│   │   └── client.ts            # PostgreSQL connection pool
│   ├── api/
│   │   ├── server.ts            # Fastify server + route registration
│   │   ├── dashboard.ts         # HTML dashboard (health, yield, pools, leaderboard)
│   │   └── routes/
│   │       ├── pulse.ts         # Analytics API routes
│   │       ├── leaderboard.ts   # Leaderboard API routes
│   │       └── tips.ts          # Tips history API routes
│   └── utils/
│       ├── logger.ts            # Pino structured JSON logging
│       ├── crypto.ts            # AES-256-GCM encryption helpers
│       ├── formatting.ts        # Amount/address formatting
│       └── retry.ts             # Exponential backoff with jitter
├── .env.example
├── package.json
├── tsconfig.json
└── drizzle.config.ts
```

---

## How TetherPulse Meets Hackathon Criteria

### Technical Correctness
- WDK properly initialized with `registerWallet()` per chain and `getAccount()` for BIP-44 derivation
- Address derivation verified: WDK and ethers.js produce identical addresses for same seed (`m/44'/60'/0'/0/0`)
- End-to-end flow: message → AI parse → chain route → WDK `transfer()` → DB record → receipt with tx hash
- Proper ERC-20 token transfers via `account.transfer({ token, recipient, amount })` returning `{ hash, fee }`
- Real Aave V3 interaction: `approve()` → `supply()` / `withdraw()` on testnet pool contracts
- 11-table relational schema with foreign keys, indexes, and constraints via Drizzle ORM
- Zod validation on all environment variables, tip amounts, and user inputs

### Degree of Agent Autonomy
- AI **autonomously** scores every qualifying message (no human trigger required)
- Auto-tip rules fire **without human approval** when contribution scores exceed user-defined threshold
- Chain routing **automatically** selects cheapest chain — zero user intervention
- Daily digest cron **generates and posts** AI summaries to channels without prompting
- Bot **replies conversationally** to all messages using Gemini, acting as a community participant
- Tip suggestions appear as **inline buttons** — one-tap to send, AI decides when to suggest

### Economic Soundness
- Smart gas routing minimizes transaction costs (gasless TON/TRON prioritized over EVM)
- Yield generation on idle capital via Aave V3 (~4-5% APY on deposited USDT)
- Crowdfunded bounty pools enable community-driven economic incentives
- 7-layer abuse prevention: self-tip blocking, rate limits, daily caps, circular detection, new account restrictions, dust prevention, pending tips for unregistered users
- Minimum tip thresholds prevent economically wasteful dust transactions
- Streak multipliers (up to 3x) incentivize sustained engagement over time

### Real-World Applicability
- Works today on Telegram with real communities — production-ready bot
- Self-custodial: users own their keys via AES-256-GCM encrypted WDK seeds
- Multi-chain support handles real-world liquidity fragmentation
- Cross-group portable reputation creates network effects across communities
- Web dashboard provides immediate value for community admins and moderators
- Pending tip system onboards new users seamlessly (tips held until `/start`)
- Built-in testnet faucet enables zero-friction testing and demos

---

## Third-Party Disclosures

| Service | Usage |
|---------|-------|
| [Tether WDK](https://docs.wdk.tether.io) | Self-custodial multi-chain wallet infrastructure (seed generation, transfers, balances) |
| [Google Gemini](https://ai.google.dev) | AI evaluation engine (tip parsing, contribution scoring, chat replies, daily digest) |
| [Aave V3](https://aave.com) | DeFi yield generation on idle USDT via lending pool contracts |
| [Telegram Bot API](https://core.telegram.org/bots/api) | Messaging platform via Telegraf v4 |
| [Supabase](https://supabase.com) | Managed PostgreSQL database hosting |
| [ethers.js](https://docs.ethers.org) | EVM contract interaction for Aave V3 and MockUSDT faucet |

---

## License

MIT

---

*Built for [Hackathon Galactica: WDK Edition 1](https://dorahacks.io/hackathon/hackathon-galactica-wdk-2026-01) by Tether*
