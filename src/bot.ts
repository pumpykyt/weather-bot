import type { BotConfig, BotState, Position, ForecastSnapshot } from './types';
import { CITIES } from './config';
import { getForecastSnapshot } from './weather';
import { searchWeatherMarkets, getMarketsByEvent, parseMarketOutcomes, placeOrder, checkResolution, getLivePrice } from './polymarket';
import { generateSignal, shouldExitStopLoss, shouldExitTakeProfit, shouldExitForecastDrift, computeStopLoss, updatePeakAndTrailing } from './trading';
import { loadState, saveState, openPosition, closePosition, updatePositionPeak, initializeBalance } from './state';
import { loadCalibration, saveCalibration, getCalibratedSigma, recordResolution, DEFAULT_SIGMA } from './calibration';
import { evaluateSignal, summarizeSession } from './hermes';
import { fetchActualTemp } from './visualcrossing';

function getTargetDates(): string[] {
  const dates: string[] = [];
  const now = new Date();
  for (let i = 0; i < 4; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() + i);
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}

function hoursUntil(targetDate: string): number {
  const target = new Date(`${targetDate}T20:00:00Z`);
  return (target.getTime() - Date.now()) / 3600000;
}

export async function fullScan(config: BotConfig): Promise<BotState> {
  const calibration = loadCalibration();
  let state = loadState();
  state = initializeBalance(state, config.balance);

  const targetDates = getTargetDates();
  console.log(`\n[bot] === Full scan starting — balance: $${state.balance.toFixed(2)} ===`);

  for (const city of CITIES) {
    for (const date of targetDates) {
      const hours = hoursUntil(date);
      if (hours < config.minHours || hours > config.maxHours) continue;

      const defaultSigma = DEFAULT_SIGMA['ecmwf'] ?? 5.0;
      const calibratedSigma = getCalibratedSigma(calibration, city.name, 'ecmwf', config.calibrationMin)
        ?? getCalibratedSigma(calibration, city.name, 'hrrr', config.calibrationMin);

      const snapshot = await getForecastSnapshot(city, date, hours, defaultSigma, calibratedSigma);
      if (!snapshot) continue;

      // Already have an open position for this city/date?
      const posId = `${city.name}_${date}`;
      const existingPos = Object.values(state.openPositions).find(p => p.city === city.name && p.date === date);
      if (existingPos) continue;

      const events = await searchWeatherMarkets(city.polymarketName ?? city.name, date);
      if (!events.length) continue;

      for (const event of events) {
        const markets = await getMarketsByEvent(event.id);
        const outcomes = await parseMarketOutcomes(markets);

        for (const outcome of outcomes) {
          const signal = generateSignal(snapshot, outcome, config, state.balance);
          if (!signal) continue;

          // Hermes evaluation (non-blocking)
          const hermesNote = await evaluateSignal(config, signal);
          if (hermesNote?.flags?.includes('skip')) {
            console.log(`[hermes] Skipping ${city.name} ${date}: ${hermesNote.note}`);
            continue;
          }

          // Final live price confirmation
          const live = await getLivePrice(signal.conditionId);
          if (live) {
            const slippage = Math.abs(live.bestAsk - signal.entryPrice);
            if (slippage / signal.entryPrice > config.maxSlippage) {
              console.log(`[bot] Slippage too high for ${city.name} — skipping`);
              continue;
            }
            signal.entryPrice = live.bestAsk;
          }

          // Execute
          try {
            const order = await placeOrder(
              signal.conditionId,
              'BUY',
              signal.entryPrice,
              signal.betSize / signal.entryPrice,
              config.polymarketApiKey,
              config.paperTrading,
            );

            if (order.filled || config.paperTrading) {
              state = openPosition(state, signal, hermesNote?.note);
              console.log(
                `[bot] OPENED ${city.name} ${date} | EV=${signal.ev.toFixed(3)} ` +
                `P=${(signal.probability * 100).toFixed(1)}% $${signal.betSize.toFixed(2)} @ ${signal.entryPrice.toFixed(3)}`
              );
              if (hermesNote) {
                console.log(`[hermes] ${hermesNote.note} [${hermesNote.confidence}]`);
              }
              // Only one position per city/date
              break;
            }
          } catch (err) {
            console.error(`[bot] Order failed for ${city.name}:`, (err as Error).message);
          }
        }
      }
    }
  }

  saveState(state);
  return state;
}

export async function quickCheck(config: BotConfig): Promise<BotState> {
  let state = loadState();
  const calibration = loadCalibration();
  let calibrationUpdated = false;

  console.log(`[bot] Quick check — ${Object.keys(state.openPositions).length} open positions`);

  for (const [posId, pos] of Object.entries(state.openPositions)) {
    const hours = hoursUntil(pos.date);

    // Check resolution first
    const finalPrice = await checkResolution(pos.conditionId);
    if (finalPrice !== null) {
      const won = finalPrice >= 0.95;
      state = closePosition(state, posId, finalPrice, 'resolution');
      console.log(`[bot] RESOLVED ${pos.city} ${pos.date} — ${won ? 'WIN' : 'LOSS'} @ ${finalPrice.toFixed(3)}`);

      // Update calibration with actual temperature
      if (config.vcKey) {
        const cityDef = CITIES.find(c => c.name === pos.city);
        if (cityDef) {
          const actualTemp = await fetchActualTemp(cityDef.lat, cityDef.lon, pos.date, config.vcKey, cityDef.unit);
          if (actualTemp !== null) {
            const updated = recordResolution(calibration, pos.city, pos.source, pos.forecastTemp, actualTemp, config.calibrationMin);
            saveCalibration(updated);
            console.log(`[calibration] ${pos.city} ${pos.source}: forecast=${pos.forecastTemp.toFixed(1)} actual=${actualTemp.toFixed(1)} error=${Math.abs(pos.forecastTemp - actualTemp).toFixed(1)}`);
          }
        }
      }
      continue;
    }

    // Live price check
    const live = await getLivePrice(pos.conditionId);
    if (!live) continue;

    const currentAsk = live.bestAsk;

    // Update peak / trailing stop
    const { peakPrice, trailingStopActive } = updatePeakAndTrailing(
      currentAsk, pos.peakPrice, pos.trailingStopActive, pos.entryPrice
    );
    if (peakPrice !== pos.peakPrice || trailingStopActive !== pos.trailingStopActive) {
      state = updatePositionPeak(state, posId, peakPrice, trailingStopActive);
    }

    // Stop-loss check
    if (shouldExitStopLoss(currentAsk, pos.entryPrice, pos.stopLoss, peakPrice, trailingStopActive)) {
      state = closePosition(state, posId, currentAsk, 'stop_loss');
      console.log(`[bot] STOP-LOSS ${pos.city} ${pos.date} @ ${currentAsk.toFixed(3)}`);
      continue;
    }

    // Take-profit check
    if (shouldExitTakeProfit(currentAsk, hours)) {
      state = closePosition(state, posId, currentAsk, 'take_profit');
      console.log(`[bot] TAKE-PROFIT ${pos.city} ${pos.date} @ ${currentAsk.toFixed(3)}`);
      continue;
    }
  }

  saveState(state);
  return state;
}

export async function printStats(config: BotConfig): Promise<void> {
  const state = loadState();
  const total = state.wins + state.losses;
  const winRate = total > 0 ? (state.wins / total * 100).toFixed(1) : '0.0';
  const openCount = Object.keys(state.openPositions).length;

  console.log('\n=== WeatherBot Stats ===');
  console.log(`Balance:       $${state.balance.toFixed(2)}`);
  console.log(`Peak Balance:  $${state.peakBalance.toFixed(2)}`);
  console.log(`Total Trades:  ${state.totalTrades}`);
  console.log(`W/L:           ${state.wins}/${state.losses} (${winRate}%)`);
  console.log(`Open:          ${openCount}`);

  const summary = await summarizeSession(config, state.balance, state.wins, state.losses, openCount);
  if (summary) console.log(`\n[hermes] ${summary}`);
}
