import axios from 'axios';
import type { BotConfig, TradingSignal, HermesMessage, HermesSignalNote } from './types';

// Hermes agent — reads endpoint from env vars set by the Hermes agent itself.
// Falls back gracefully if the model is unavailable.

const HERMES_BASE_URL = process.env.HERMES_BASE_URL ?? 'http://localhost:11434';
const HERMES_MODEL    = process.env.HERMES_MODEL    ?? 'hermes3';

const SYSTEM_PROMPT = `You are a quantitative trading analyst for a weather prediction market bot on Polymarket.
Your role is to evaluate trading signals, flag risks, and provide concise commentary.
Be brief: max 2 sentences per note. Return valid JSON only.`;

async function callHermes(messages: HermesMessage[]): Promise<string | null> {
  try {
    const res = await axios.post(
      `${HERMES_BASE_URL}/api/chat`,
      {
        model: HERMES_MODEL,
        messages,
        stream: false,
        options: { temperature: 0.3, num_predict: 200 },
      },
      { timeout: 15000 }
    );
    return res.data?.message?.content ?? null;
  } catch {
    // Hermes unavailable — continue without AI commentary
    return null;
  }
}

export async function evaluateSignal(
  _config: BotConfig,
  signal: TradingSignal,
): Promise<HermesSignalNote | null> {
  const userMsg = `
Evaluate this weather market signal:
- City: ${signal.city}, Date: ${signal.date}
- Question: ${signal.question}
- Forecast: ${signal.forecastTemp.toFixed(1)}°, Sigma: ${signal.sigma.toFixed(2)}
- Probability: ${(signal.probability * 100).toFixed(1)}%, EV: ${signal.ev.toFixed(3)}
- Entry Price: ${signal.entryPrice.toFixed(3)}, Bet Size: $${signal.betSize.toFixed(2)}
- Source: ${signal.source}

Return JSON: {"note": "...", "confidence": "high|medium|low", "flags": ["..."]}
`;

  const messages: HermesMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user',   content: userMsg },
  ];

  const raw = await callHermes(messages);
  if (!raw) return null;

  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    return JSON.parse(jsonMatch[0]) as HermesSignalNote;
  } catch {
    return null;
  }
}

export async function summarizeSession(
  _config: BotConfig,
  balance: number,
  wins: number,
  losses: number,
  openCount: number,
): Promise<string | null> {
  const userMsg = `
Summarize this trading session:
- Balance: $${balance.toFixed(2)}
- Wins: ${wins}, Losses: ${losses}
- Win Rate: ${wins + losses > 0 ? ((wins / (wins + losses)) * 100).toFixed(1) : 0}%
- Open Positions: ${openCount}

Return a one-sentence summary and one recommended action.
`;

  const messages: HermesMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user',   content: userMsg },
  ];

  return callHermes(messages);
}
