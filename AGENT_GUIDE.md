# Hermes — Weather Trading Agent (TypeScript Edition)

A production-grade Polymarket weather trading agent running 24/7, built in TypeScript
with self-calibrating forecasts across 40+ cities and 3 weather sources feeding into
Expected Value and Kelly Criterion position sizing. Uses your existing Polymarket
balance directly — no separate wallet needed.

This is a copy-paste guide for your Hermes agent. No manual coding required.
**Total setup time: ~15 minutes.**

---

## PROMPT 1 — Clone and install

```
clone the bot and install dependencies:

git clone https://github.com/pumpykyt/weather-bot.git
cd weather-bot
npm install
npx tsc

then copy the config template:
cp config.example.json config.json

confirm dist/index.js exists
```

---

## PROMPT 2 — Configure the bot

Get your Polymarket API key: polymarket.com → Settings → API Keys → Create Key.
Visual Crossing key is already set in the repo — skip that step.

```
edit weather-bot/config.json and set:
- balance: your current Polymarket USDC balance (e.g. 200)
- maxBet: 2.0
- minEv: 0.10
- paperTrading: true
- polymarketApiKey: YOUR_POLYMARKET_API_KEY
- vcKey: YOUR_VISUAL_CROSSING_KEY

leave everything else at default
```

> Keep `paperTrading: true` for now — always test before going live.

---

## PROMPT 3 — Run a paper trading scan

```
cd weather-bot && node dist/index.js --scan

show me every signal it found
```

You'll see output like:

```
[polymarket] Fetched 55 temperature events
[bot] OPENED New York City 2026-05-23 | EV=0.43 P=42.1% $2.00 @ 0.320
[bot] OPENED London 2026-05-23 | EV=0.21 P=55.3% $1.80 @ 0.620
[bot] OPENED Tokyo 2026-05-23 | EV=0.15 P=38.7% $1.20 @ 0.440
```

---

## PROMPT 4 — Start continuous trading

Once satisfied with the paper results:

```
set paperTrading to false in weather-bot/config.json

then start the bot as a background process:
cd weather-bot && nohup node dist/index.js > logs/bot.log 2>&1 &

create the logs folder first if it doesn't exist:
mkdir -p weather-bot/logs

show me the process id and the first 30 lines of the log
```

The bot will:
- Scan all 40+ cities every 60 minutes
- Check open positions every 10 minutes (stop-loss / take-profit)
- Auto-calibrate forecast accuracy after each resolved market
- Write all state to `data/` — persists across restarts

---

## PROMPT 5 — Check stats anytime

```
cd weather-bot && node dist/index.js --stats
```

Output:

```
=== WeatherBot Stats ===
Balance:       $247.83
Peak Balance:  $312.10
Total Trades:  94
W/L:           61/33 (64.9%)
Open:          7
```

---

## PROMPT 6 — Pull updates

When the bot is updated:

```
cd weather-bot
pkill -f "node dist/index.js" || true
git pull
npm install
npx tsc
nohup node dist/index.js > logs/bot.log 2>&1 &
```

Your `config.json` and `data/` folder are gitignored so they survive pulls.

---

## PROMPT 7 — Add Telegram alerts (optional)

```
add Telegram trade alerts to weather-bot/src/bot.ts.
install node-telegram-bot-api and @types/node-telegram-bot-api.
read TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID from process.env.

send a message on:
- every new position opened: city, date, EV, bet size, entry price
- every position closed: city, P&L, exit reason
- hourly stats: balance, W/L, open count

do nothing if the env vars are not set.

after editing, rebuild: cd weather-bot && npx tsc
```

Set the env vars before starting the bot:
```
export TELEGRAM_BOT_TOKEN=your_token
export TELEGRAM_CHAT_ID=your_chat_id
```

---

## PROMPT 8 — Read calibration data

```
cat weather-bot/data/calibration.json

tell me which cities have the tightest sigma (most accurate forecasts)
and which have the most forecast error
```

---

## How the bot improves itself

After each resolved market the bot fetches the actual temperature from Visual Crossing,
compares it to the forecast it traded on, and updates `data/calibration.json`.
Once 30+ samples accumulate per city/source pair, sigma auto-tightens — probability
estimates improve over time without any manual intervention.

---

## Key files

| File | Purpose |
|---|---|
| `config.json` | All trading parameters (gitignored — stays local) |
| `config.example.json` | Safe template committed to the repo |
| `data/state.json` | Live balance, W/L, open positions |
| `data/markets/` | Per-trade JSON files |
| `data/calibration.json` | Per-city forecast accuracy |
| `logs/bot.log` | Runtime output |
| `src/` | Full TypeScript source |

---

## Tuning guide

| Parameter | Conservative | Aggressive |
|---|---|---|
| `maxBet` | $2 | $20 |
| `minEv` | 0.15 | 0.05 |
| `kellyFraction` | 0.15 | 0.35 |
| `maxPrice` | 0.40 | 0.50 |
| `minVolume` | 1000 | 200 |

Start conservative. Let calibration run for 2–3 weeks before tuning.
