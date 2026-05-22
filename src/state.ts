import * as fs from 'fs';
import * as path from 'path';
import type { BotState, Position, ClosedTrade, TradingSignal, ExitReason } from './types';

const DATA_DIR      = path.join(process.cwd(), 'data');
const STATE_PATH    = path.join(DATA_DIR, 'state.json');
const MARKETS_DIR   = path.join(DATA_DIR, 'markets');

const DEFAULT_STATE: BotState = {
  balance: 10000,
  peakBalance: 10000,
  totalTrades: 0,
  wins: 0,
  losses: 0,
  openPositions: {},
  tradeHistory: [],
};

export function loadState(): BotState {
  if (!fs.existsSync(STATE_PATH)) return { ...DEFAULT_STATE };
  try {
    return JSON.parse(fs.readFileSync(STATE_PATH, 'utf-8'));
  } catch {
    return { ...DEFAULT_STATE };
  }
}

export function saveState(state: BotState): void {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
}

export function openPosition(state: BotState, signal: TradingSignal, hermesNote?: string): BotState {
  const shares = signal.betSize / signal.entryPrice;
  const posId = `${signal.city}_${signal.date}_${signal.marketId}`;

  const position: Position = {
    id: posId,
    city: signal.city,
    date: signal.date,
    marketId: signal.marketId,
    conditionId: signal.conditionId,
    question: signal.question,
    bucket: signal.bucket,
    entryPrice: signal.entryPrice,
    shares,
    betSize: signal.betSize,
    forecastTemp: signal.forecastTemp,
    sigma: signal.sigma,
    probability: signal.probability,
    ev: signal.ev,
    source: signal.source,
    openedAt: new Date().toISOString(),
    stopLoss: signal.entryPrice * 0.80,
    peakPrice: signal.entryPrice,
    trailingStopActive: false,
    hermesNote,
  };

  const newState = {
    ...state,
    balance: state.balance - signal.betSize,
    totalTrades: state.totalTrades + 1,
    openPositions: { ...state.openPositions, [posId]: position },
  };

  // Persist individual market file
  fs.mkdirSync(MARKETS_DIR, { recursive: true });
  fs.writeFileSync(
    path.join(MARKETS_DIR, `${posId}.json`),
    JSON.stringify(position, null, 2)
  );

  return newState;
}

export function closePosition(
  state: BotState,
  positionId: string,
  exitPrice: number,
  exitReason: ExitReason,
): BotState {
  const pos = state.openPositions[positionId];
  if (!pos) return state;

  const pnl = (exitPrice - pos.entryPrice) * pos.shares;
  const won = exitPrice >= 0.95;

  const closed: ClosedTrade = {
    ...pos,
    exitPrice,
    closedAt: new Date().toISOString(),
    pnl,
    exitReason,
  };

  const newBalance = state.balance + pos.betSize + pnl;
  const { [positionId]: _, ...remaining } = state.openPositions;

  const newState: BotState = {
    ...state,
    balance: newBalance,
    peakBalance: Math.max(state.peakBalance, newBalance),
    wins: won ? state.wins + 1 : state.wins,
    losses: won ? state.losses : state.losses + 1,
    openPositions: remaining,
    tradeHistory: [closed, ...state.tradeHistory].slice(0, 200),
  };

  // Update market file with resolution info
  const marketFile = path.join(MARKETS_DIR, `${positionId}.json`);
  if (fs.existsSync(marketFile)) {
    fs.writeFileSync(marketFile, JSON.stringify(closed, null, 2));
  }

  return newState;
}

export function updatePositionPeak(
  state: BotState,
  positionId: string,
  peakPrice: number,
  trailingStopActive: boolean,
): BotState {
  const pos = state.openPositions[positionId];
  if (!pos) return state;

  return {
    ...state,
    openPositions: {
      ...state.openPositions,
      [positionId]: { ...pos, peakPrice, trailingStopActive },
    },
  };
}

export function initializeBalance(state: BotState, configBalance: number): BotState {
  if (state.balance === DEFAULT_STATE.balance && state.totalTrades === 0) {
    return { ...state, balance: configBalance, peakBalance: configBalance };
  }
  return state;
}
