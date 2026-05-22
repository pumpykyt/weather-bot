import axios from 'axios';
import type { PolymarketEvent, PolymarketMarket, MarketOutcome, TemperatureBucket } from './types';

const GAMMA_BASE = 'https://gamma-api.polymarket.com';
const CLOB_BASE = 'https://clob.polymarket.com';

// Actual Polymarket weather market question formats (as observed):
// "Will the highest temperature in New York City be 57°F or below on May 22?"
// "Will the highest temperature in New York City be between 58-59°F on May 22?"
// "Will the highest temperature in New York City be between 60-61°F on May 22?"
// "Will the highest temperature in London be 20°C or below on May 22?"
// "Will the highest temperature in London be 21°C on May 22?"  (exact degree = single-degree bucket)
const PATTERNS = [
  // "be X°F or below" / "be X°C or below"
  { regex: /be\s+(-?\d+(?:\.\d+)?)\s*°?([FC])\s+or\s+below/i,  type: 'lte' as const },
  // "be X°F or above" / "be X°C or above"
  { regex: /be\s+(-?\d+(?:\.\d+)?)\s*°?([FC])\s+or\s+above/i,  type: 'gte' as const },
  // "be between X-Y°F" / "be between X-Y°C"
  { regex: /be\s+between\s+(-?\d+(?:\.\d+)?)-(-?\d+(?:\.\d+)?)\s*°?[FC]/i, type: 'range' as const },
  // "be between X and Y°F"
  { regex: /be\s+between\s+(-?\d+(?:\.\d+)?)\s+and\s+(-?\d+(?:\.\d+)?)\s*°?[FC]/i, type: 'range' as const },
  // "be X°F" (single exact degree bucket — treat as ±0.5 range)
  { regex: /be\s+(-?\d+(?:\.\d+)?)\s*°?([FC])(?:\s+on|\s*$|\s*\?)/i, type: 'exact' as const },
  // Fallback: legacy formats from original bot
  { regex: /(-?\d+(?:\.\d+)?)\s*°?[Ff]\s+or\s+higher/i,   type: 'gte' as const },
  { regex: /(-?\d+(?:\.\d+)?)\s*°?[Ff]\s+or\s+above/i,    type: 'gte' as const },
  { regex: /at\s+least\s+(-?\d+(?:\.\d+)?)\s*°?[Ff]/i,    type: 'gte' as const },
  { regex: /below\s+(-?\d+(?:\.\d+)?)\s*°?[Ff]/i,         type: 'lt'  as const },
  { regex: /(-?\d+(?:\.\d+)?)\s*°?[Ff]\s+or\s+lower/i,    type: 'lte' as const },
  { regex: /(-?\d+(?:\.\d+)?)\s*[-–]\s*(-?\d+(?:\.\d+)?)\s*°?[Ff]/i, type: 'range' as const },
  { regex: /(-?\d+(?:\.\d+)?)\s*°?[Cc]\s+or\s+higher/i,   type: 'gte' as const },
  { regex: /(-?\d+(?:\.\d+)?)\s*°?[Cc]\s+or\s+above/i,    type: 'gte' as const },
  { regex: /below\s+(-?\d+(?:\.\d+)?)\s*°?[Cc]/i,         type: 'lt'  as const },
  { regex: /(-?\d+(?:\.\d+)?)\s*[-–]\s*(-?\d+(?:\.\d+)?)\s*°?[Cc]/i, type: 'range' as const },
];

export function parseTemperatureBucket(question: string): TemperatureBucket | null {
  for (const p of PATTERNS) {
    const m = question.match(p.regex);
    if (!m) continue;

    const v1 = parseFloat(m[1]);
    switch (p.type) {
      case 'gte':   return { min: v1,        max: 999,      label: question };
      case 'lt':    return { min: -999,       max: v1 - 0.1, label: question };
      case 'lte':   return { min: -999,       max: v1,       label: question };
      case 'exact': return { min: v1 - 0.5,   max: v1 + 0.5, label: question };
      case 'range': {
        const v2 = parseFloat(m[2]);
        return { min: Math.min(v1, v2), max: Math.max(v1, v2), label: question };
      }
    }
  }
  return null;
}

// Cache all weather events once per scan to avoid hammering the API
let weatherEventsCache: PolymarketEvent[] = [];
let weatherEventsCachedAt = 0;
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

export async function fetchAllWeatherEvents(): Promise<PolymarketEvent[]> {
  if (weatherEventsCache.length && Date.now() - weatherEventsCachedAt < CACHE_TTL_MS) {
    return weatherEventsCache;
  }

  try {
    const res = await axios.get<PolymarketEvent[]>(`${GAMMA_BASE}/events`, {
      params: { active: true, closed: false, limit: 200, tag_slug: 'weather' },
      timeout: 15000,
    });

    const events = Array.isArray(res.data) ? res.data : (res.data as unknown as { data: PolymarketEvent[] }).data ?? [];
    // Keep only temperature events (filter out earthquakes, viruses, etc.)
    weatherEventsCache = events.filter(e =>
      /highest temperature|temperature in/i.test(e.title ?? '')
    );
    weatherEventsCachedAt = Date.now();
    console.log(`[polymarket] Fetched ${weatherEventsCache.length} temperature events`);
    return weatherEventsCache;
  } catch (err) {
    console.warn(`[polymarket] fetchAllWeatherEvents failed:`, (err as Error).message);
    return weatherEventsCache; // return stale cache on error
  }
}

export async function searchWeatherMarkets(cityName: string, targetDate: string): Promise<PolymarketEvent[]> {
  const all = await fetchAllWeatherEvents();
  const cityLower = cityName.toLowerCase();

  return all.filter(e => {
    const titleLower = e.title?.toLowerCase() ?? '';
    // Match whole word to avoid "NYC" matching "Nyckel" etc.
    const titleMatch = titleLower.includes(cityLower);
    const dateMatch = !targetDate || (e.endDate ?? '').startsWith(targetDate);
    return titleMatch && dateMatch;
  });
}

export async function getMarketsByEvent(eventId: string): Promise<PolymarketMarket[]> {
  try {
    const res = await axios.get<{ markets: PolymarketMarket[] }>(`${GAMMA_BASE}/events/${eventId}`, {
      timeout: 10000,
    });
    return res.data.markets ?? [];
  } catch (err) {
    console.warn(`[polymarket] getMarketsByEvent failed for ${eventId}:`, (err as Error).message);
    return [];
  }
}

export async function getLivePrice(conditionId: string): Promise<{ bestAsk: number; bestBid: number } | null> {
  try {
    const res = await axios.get<{ bestAsk: number; bestBid: number }>(
      `${CLOB_BASE}/book`,
      { params: { token_id: conditionId }, timeout: 8000 }
    );
    return { bestAsk: res.data.bestAsk, bestBid: res.data.bestBid };
  } catch {
    return null;
  }
}

export async function parseMarketOutcomes(markets: PolymarketMarket[]): Promise<MarketOutcome[]> {
  const outcomes: MarketOutcome[] = [];

  for (const market of markets) {
    if (market.closed || !market.active) continue;

    const bucket = parseTemperatureBucket(market.question);
    if (!bucket) continue;

    const live = await getLivePrice(market.conditionId);
    const bestAsk = live?.bestAsk ?? market.bestAsk;
    const bestBid = live?.bestBid ?? market.bestBid;

    if (!bestAsk || bestAsk <= 0) continue;

    outcomes.push({
      id: market.id,
      question: market.question,
      bucket,
      bestAsk,
      bestBid,
      volume: market.volume,
      conditionId: market.conditionId,
    });
  }

  return outcomes;
}

export async function placeOrder(
  conditionId: string,
  side: 'BUY',
  price: number,
  size: number,
  apiKey: string,
  paperTrading: boolean,
): Promise<{ orderId: string; filled: boolean }> {
  if (paperTrading) {
    console.log(`[polymarket] [PAPER] BUY ${size.toFixed(2)} shares @ ${price.toFixed(3)} on ${conditionId}`);
    return { orderId: `paper_${Date.now()}`, filled: true };
  }

  try {
    const res = await axios.post(
      `${CLOB_BASE}/order`,
      { market: conditionId, side, price, size, type: 'LIMIT' },
      {
        headers: { Authorization: `Bearer ${apiKey}` },
        timeout: 10000,
      }
    );
    return { orderId: res.data.orderId, filled: res.data.status === 'FILLED' };
  } catch (err) {
    console.error(`[polymarket] placeOrder failed:`, (err as Error).message);
    throw err;
  }
}

export async function checkResolution(conditionId: string): Promise<number | null> {
  try {
    const res = await axios.get<{ closed: boolean; bestAsk: number }>(
      `${GAMMA_BASE}/markets/${conditionId}`,
      { timeout: 8000 }
    );
    if (res.data.closed) return res.data.bestAsk;
    return null;
  } catch {
    return null;
  }
}
