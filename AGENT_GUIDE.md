# Hermes — Weather Trading Agent (TypeScript Edition)

A production-grade Polymarket weather trading agent running 24/7, built in TypeScript with
self-calibrating forecasts across 40+ cities and 3 weather sources feeding into Expected Value
and Kelly Criterion position sizing.

This is a copy-paste guide for your Hermes agent. No manual coding required.
**Total setup time: ~20 minutes.**

---

## PROMPT 1 — Install dependencies and build

The bot is already cloned. Tell your agent:

```
cd D:\weather-bot and run: npm install
then build it: npx tsc
confirm the dist/ folder exists and contains index.js
```

---

## PROMPT 2 — Create a Polymarket wallet

Set up a dedicated wallet for the bot. Ask Hermes:

```
create a new Ethereum/Polygon wallet for me using ethers.js or viem in Node.js.
show me the address and private key.
save them to D:\weather-bot\.env as:

POLYMARKET_PK=the_private_key
POLYMARKET_ADDRESS=the_wallet_address
```

Save the address and private key it gives you.

---

## PROMPT 3 — Fund the wallet (you do this yourself)

Send to the wallet address on **Polygon** network:
- **USDC** — your trading capital ($10 min, $50 recommended)
- **POL** — ~2 POL for gas (~$0.50)

Once funded, tell your agent:

```
check the balance of my Polygon wallet. address is 0xYOUR_ADDRESS.
check both POL and USDC (contract: 0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359)
```

---

## PROMPT 4 — Approve Polymarket contracts

```
i need to approve USDC spending for Polymarket on Polygon.
my wallet private key is in D:\weather-bot\.env as POLYMARKET_PK.

send ERC20 approve (max uint256) for USDC (0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359)
to these 3 contracts:

1. CTF Exchange:    0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E
2. Neg Risk Exchange: 0xC5d563A36AE78145C45a50134d48A1215220f80a
3. Router:          0xd91E80cF2E7be2e162c6513ceD06f1dD0dA35296

also call setApprovalForAll on the Conditional Tokens contract
(0x4D97DCd97eC945f40cF65F87097ACe5EA0476045) for the same 3 spenders.

use ethers.js, EIP-1559, chain id 137, wait for each receipt.
set HERMES_BASE_URL and HERMES_MODEL in the .env if not already set.
```

---

## PROMPT 5 — Configure the bot

Visual Crossing is already wired in. Just set your capital and flip to live mode:

```
edit D:\weather-bot\config.json and set:
- balance: match my actual USDC balance (e.g. 100)
- maxBet: 2.0    (dollars per trade, start small)
- minEv: 0.10    (only trade when edge is 10%+)
- paperTrading: false
- polymarketApiKey: YOUR_POLYMARKET_API_KEY

leave everything else default
```

To get your Polymarket API key: go to polymarket.com → Settings → API Keys → Create Key.

> **Start with `paperTrading: true` first** — run a few scan cycles and check the output
> before switching to live. The paper mode is identical except no real orders are sent.

---

## PROMPT 6 — Run a test scan

```
cd D:\weather-bot and run: node dist/index.js --scan
show me every trade signal it found and what it would have bought
```

You'll see output like:

```
[polymarket] Fetched 55 temperature events
[bot] OPENED New York City 2026-05-23 | EV=0.434 P=42.1% $2.00 @ 0.320
[bot] OPENED London 2026-05-23 | EV=0.21 P=55.3% $1.80 @ 0.620
[bot] OPENED Tokyo 2026-05-23 | EV=0.15 P=38.7% $1.20 @ 0.440
```

---

## PROMPT 7 — Start continuous trading

Once you're happy with the paper results:

```
set paperTrading to false in D:\weather-bot\config.json
then start the bot as a background process:

node dist/index.js

it will:
- run a full scan every 60 minutes across 40+ cities
- check open positions every 10 minutes for stop-loss and take-profit
- self-calibrate forecast accuracy using Visual Crossing after each resolved market
- log every trade to data/state.json and data/markets/

show me the current open positions and balance after the first scan
```

---

## PROMPT 8 — Add Telegram alerts (optional)

```
add Telegram trade alerts to D:\weather-bot\src\bot.ts.
use the node-telegram-bot-api package.
read TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID from the .env file.

send a message on:
- every new position opened (city, date, EV, bet size, entry price)
- every position closed (city, P&L, exit reason)
- stats summary every 6 hours (balance, W/L, open count)

keep it silent if the env vars are not set
```

---

## PROMPT 9 — Check stats anytime

```
cd D:\weather-bot and run: node dist/index.js --stats
```

You'll see:

```
=== WeatherBot Stats ===
Balance:       $247.83
Peak Balance:  $312.10
Total Trades:  94
W/L:           61/33 (64.9%)
Open:          7
```

---

## How the bot improves itself

After each resolved market the bot fetches the actual temperature from **Visual Crossing**,
compares it to the forecast it traded on, and updates `data/calibration.json`.
Once 30+ samples accumulate for a city/source pair, sigma auto-tightens — making
probability estimates more accurate for that city over time.

You can ask Hermes to inspect calibration at any time:

```
read D:\weather-bot\data\calibration.json and tell me which cities
have the most accurate forecasts and which have the most error
```

---

## Key files

| File | Purpose |
|---|---|
| `config.json` | All trading parameters |
| `data/state.json` | Live balance, W/L, open positions |
| `data/markets/` | Per-trade JSON files |
| `data/calibration.json` | Per-city forecast accuracy |
| `src/` | Full TypeScript source (editable) |

---

## Tuning guide

| Parameter | Conservative | Aggressive |
|---|---|---|
| `maxBet` | $2 | $20 |
| `minEv` | 0.15 | 0.05 |
| `kellyFraction` | 0.15 | 0.35 |
| `maxPrice` | 0.40 | 0.50 |
| `minVolume` | 1000 | 200 |

Start conservative. Let the calibration loop run for 2–3 weeks before tuning.
