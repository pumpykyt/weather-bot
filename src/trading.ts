import type { ForecastSnapshot, MarketOutcome, TradingSignal, BotConfig, TemperatureBucket } from './types';

// Approximation of the standard normal CDF using the Abramowitz & Stegun method
function normalCDF(x: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const poly = t * (0.319381530
    + t * (-0.356563782
    + t * (1.781477937
    + t * (-1.821255978
    + t * 1.330274429))));
  const pdf = Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
  const cdf = 1 - pdf * poly;
  return x >= 0 ? cdf : 1 - cdf;
}

// P(temp falls in [bucketMin, bucketMax]) given forecast~N(mu, sigma)
export function bucketProbability(
  forecastTemp: number,
  bucket: TemperatureBucket,
  sigma: number,
): number {
  const zHigh = (bucket.max - forecastTemp) / sigma;
  const zLow  = (bucket.min - forecastTemp) / sigma;

  const pHigh = bucket.max >= 999 ? 1.0 : normalCDF(zHigh);
  const pLow  = bucket.min <= -999 ? 0.0 : normalCDF(zLow);

  return Math.max(0, Math.min(1, pHigh - pLow));
}

// Expected value for a binary YES outcome at price p with probability prob
export function expectedValue(probability: number, price: number): number {
  if (price <= 0 || price >= 1) return -Infinity;
  // EV = prob * (1/price - 1) - (1 - prob)
  return probability * (1 / price - 1) - (1 - probability);
}

// Fractional Kelly bet fraction
export function kellyBet(
  probability: number,
  price: number,
  kellyFraction: number,
): number {
  const b = 1 / price - 1; // net odds on a $1 bet
  const q = 1 - probability;
  const fullKelly = (probability * b - q) / b;
  return Math.max(0, fullKelly * kellyFraction);
}

export function generateSignal(
  snapshot: ForecastSnapshot,
  outcome: MarketOutcome,
  config: BotConfig,
  balance: number,
): TradingSignal | null {
  const { temperature, sigma, source } = snapshot;
  const { bucket, bestAsk, volume, conditionId, question, id } = outcome;

  // --- Filters ---
  if (volume < config.minVolume) return null;
  if (bestAsk > config.maxPrice) return null;
  if (bestAsk <= 0) return null;

  // Forecast must land reasonably close to the bucket for a signal
  // (within 2 sigma of at least one bucket boundary)
  const distToMin = Math.abs(temperature - bucket.min);
  const distToMax = Math.abs(temperature - bucket.max);
  const inOrNear = temperature >= bucket.min && temperature <= bucket.max;
  if (!inOrNear && distToMin > 3 * sigma && distToMax > 3 * sigma) return null;

  const probability = bucketProbability(temperature, bucket, sigma);
  const ev = expectedValue(probability, bestAsk);

  if (ev < config.minEv) return null;

  const fraction = kellyBet(probability, bestAsk, config.kellyFraction);
  let betSize = fraction * balance;
  betSize = Math.max(0.50, Math.min(config.maxBet, betSize));

  // Spread check
  const spread = outcome.bestAsk - outcome.bestBid;
  if (spread > config.maxSlippage) return null;

  return {
    city: snapshot.city,
    date: snapshot.date,
    marketId: id,
    conditionId,
    question,
    bucket,
    forecastTemp: temperature,
    probability,
    ev,
    entryPrice: bestAsk,
    betSize,
    kellyFraction: fraction,
    sigma,
    source,
  };
}

export function shouldExitStopLoss(
  currentAsk: number,
  entryPrice: number,
  stopLoss: number,
  peakPrice: number,
  trailingStopActive: boolean,
): boolean {
  if (trailingStopActive) {
    // Trailing stop: exit if price drops >20% below peak
    return currentAsk < peakPrice * 0.80;
  }
  return currentAsk < stopLoss;
}

export function shouldExitTakeProfit(
  currentAsk: number,
  hoursUntilResolution: number,
): boolean {
  if (hoursUntilResolution >= 48) return currentAsk >= 0.75;
  if (hoursUntilResolution >= 24) return currentAsk >= 0.85;
  return currentAsk >= 0.92;
}

export function shouldExitForecastDrift(
  newForecastTemp: number,
  bucket: TemperatureBucket,
  originalForecastTemp: number,
  sigma: number,
): boolean {
  const inBucket = newForecastTemp >= bucket.min && newForecastTemp <= bucket.max;
  if (inBucket) return false;

  const distToMin = newForecastTemp - bucket.min; // negative = below min
  const distToMax = newForecastTemp - bucket.max; // positive = above max

  const outsideDist = newForecastTemp < bucket.min ? Math.abs(distToMin) : Math.abs(distToMax);
  return outsideDist > 2 * sigma;
}

export function computeStopLoss(entryPrice: number): number {
  return entryPrice * 0.80;
}

export function updatePeakAndTrailing(
  currentAsk: number,
  peakPrice: number,
  trailingStopActive: boolean,
  entryPrice: number,
): { peakPrice: number; trailingStopActive: boolean } {
  const newPeak = Math.max(peakPrice, currentAsk);
  // Activate trailing stop once position is +20% above entry
  const activated = trailingStopActive || (currentAsk >= entryPrice * 1.20);
  return { peakPrice: newPeak, trailingStopActive: activated };
}
