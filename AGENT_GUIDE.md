# Hermes — Weather Trading Agent (TypeScript Edition)

A production-grade Polymarket weather trading agent running 24/7 in Docker, built in TypeScript
with self-calibrating forecasts across 40+ cities and 3 weather sources feeding into Expected
Value and Kelly Criterion position sizing. Uses your existing Polymarket balance directly —
no separate wallet needed.

This is a copy-paste guide for your Hermes agent. No manual coding required.
**Total setup time: ~15 minutes.**

---

## PROMPT 1 — Clone and set up the environment

```
pull the bot from GitHub and set it up in Docker:

git clone https://github.com/pumpykyt/weather-bot.git
cd weather-bot

copy config.example.json to config.json:
cp config.example.json config.json

create a .env file with this content:
HERMES_BASE_URL=http://host.docker.internal:11434
HERMES_MODEL=hermes3
```

---

## PROMPT 2 — Configure the bot

Get your Polymarket API key: polymarket.com → Settings → API Keys → Create Key.
Get your Visual Crossing key: visualcrossing.com → free account → copy API key.

```
edit weather-bot/config.json and set these values:
- balance: your current Polymarket USDC balance (e.g. 200)
- maxBet: 2.0
- minEv: 0.10
- paperTrading: true
- polymarketApiKey: YOUR_POLYMARKET_API_KEY
- vcKey: YOUR_VISUAL_CROSSING_KEY

leave everything else at its default
```

> Keep `paperTrading: true` for now — we test first before going live.

---

## PROMPT 3 — Write a Dockerfile and build

```
create a Dockerfile in the weather-bot folder:

FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npx tsc
CMD ["node", "dist/index.js"]

then build the image:
docker build -t weather-bot .
```

---

## PROMPT 4 — Run a paper trading scan

```
run a one-shot scan in paper mode to confirm everything works:

docker run --rm \
  -v $(pwd)/config.json:/app/config.json \
  -v $(pwd)/data:/app/data \
  --env-file .env \
  weather-bot node dist/index.js --scan

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

## PROMPT 5 — Start continuous trading

Once you're satisfied with the paper results, flip to live and start the bot:

```
set paperTrading to false in config.json

then start the bot as a persistent Docker container:

docker run -d \
  --name weather-bot \
  --restart unless-stopped \
  -v $(pwd)/config.json:/app/config.json \
  -v $(pwd)/data:/app/data \
  --env-file .env \
  weather-bot

confirm it is running:
docker logs weather-bot --tail 50
```

The bot will:
- Scan all 40+ cities every 60 minutes
- Check open positions every 10 minutes (stop-loss / take-profit)
- Auto-calibrate forecast accuracy after each resolved market

---

## PROMPT 6 — Check stats anytime

```
docker exec weather-bot node dist/index.js --stats
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

## PROMPT 7 — Pull updates from GitHub

When the bot gets updated:

```
docker stop weather-bot && docker rm weather-bot
git pull https://github.com/pumpykyt/weather-bot.git
docker build -t weather-bot .
docker run -d \
  --name weather-bot \
  --restart unless-stopped \
  -v $(pwd)/config.json:/app/config.json \
  -v $(pwd)/data:/app/data \
  --env-file .env \
  weather-bot
```

Your `config.json` and `data/` folder are mounted as volumes so they survive container rebuilds.

---

## PROMPT 8 — Add Telegram alerts (optional)

```
add Telegram trade alerts to weather-bot/src/bot.ts.
install node-telegram-bot-api and its types.
read TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID from process.env.

send a message on:
- every new position opened: city, date, EV, bet size, entry price
- every position closed: city, P&L, exit reason
- hourly stats: balance, W/L, open positions count

do nothing if the env vars are not set.
rebuild the Docker image after.
```

Add to `.env`:
```
TELEGRAM_BOT_TOKEN=your_token
TELEGRAM_CHAT_ID=your_chat_id
```

---

## PROMPT 9 — Read calibration data

```
docker exec weather-bot cat data/calibration.json | show me which cities
have the tightest sigma (most accurate forecasts) and which have the most error
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
| `config.json` | All trading parameters (mounted as volume, not in image) |
| `config.example.json` | Safe template to copy from |
| `data/state.json` | Live balance, W/L, open positions |
| `data/markets/` | Per-trade JSON files |
| `data/calibration.json` | Per-city forecast accuracy |
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
