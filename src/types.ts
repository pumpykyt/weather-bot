export interface CityConfig {
  name: string;
  polymarketName?: string; // override when Polymarket uses a different name (e.g. "NYC" vs "New York City")
  lat: number;
  lon: number;
  airportCode: string;
  timezone: string;
  unit: 'fahrenheit' | 'celsius';
  country: string;
}

export interface BotConfig {
  balance: number;
  maxBet: number;
  minEv: number;
  maxPrice: number;
  minVolume: number;
  minHours: number;
  maxHours: number;
  kellyFraction: number;
  scanInterval: number;
  calibrationMin: number;
  maxSlippage: number;
  vcKey: string;
  polymarketApiKey: string;
  paperTrading: boolean;
}

export interface ForecastSnapshot {
  city: string;
  date: string;
  temperature: number;
  source: 'ecmwf' | 'hrrr' | 'metar';
  sigma: number;
  fetchedAt: string;
  hoursUntilResolution: number;
}

export interface TemperatureBucket {
  min: number;
  max: number;
  label: string;
}

export interface MarketOutcome {
  id: string;
  question: string;
  bucket: TemperatureBucket;
  bestAsk: number;
  bestBid: number;
  volume: number;
  conditionId: string;
}

export interface PolymarketEvent {
  id: string;
  title: string;
  slug: string;
  startDate: string;
  endDate: string;
  markets: PolymarketMarket[];
}

export interface PolymarketMarket {
  id: string;
  question: string;
  conditionId: string;
  bestAsk: number;
  bestBid: number;
  volume: number;
  active: boolean;
  closed: boolean;
  resolutionTime: string;
}

export interface TradingSignal {
  city: string;
  date: string;
  marketId: string;
  conditionId: string;
  question: string;
  bucket: TemperatureBucket;
  forecastTemp: number;
  probability: number;
  ev: number;
  entryPrice: number;
  betSize: number;
  kellyFraction: number;
  sigma: number;
  source: string;
}

export type ExitReason = 'stop_loss' | 'take_profit' | 'forecast_drift' | 'resolution' | 'manual';

export interface Position {
  id: string;
  city: string;
  date: string;
  marketId: string;
  conditionId: string;
  question: string;
  bucket: TemperatureBucket;
  entryPrice: number;
  shares: number;
  betSize: number;
  forecastTemp: number;
  sigma: number;
  probability: number;
  ev: number;
  source: string;
  openedAt: string;
  stopLoss: number;
  peakPrice: number;
  trailingStopActive: boolean;
  hermesNote?: string;
}

export interface ClosedTrade extends Position {
  exitPrice: number;
  closedAt: string;
  pnl: number;
  exitReason: ExitReason;
}

export interface BotState {
  balance: number;
  peakBalance: number;
  totalTrades: number;
  wins: number;
  losses: number;
  openPositions: Record<string, Position>;
  tradeHistory: ClosedTrade[];
}

export interface CalibrationEntry {
  mae: number;
  count: number;
  sigma: number;
}

export type CalibrationData = Record<string, Record<string, CalibrationEntry>>;

export interface HermesMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface HermesSignalNote {
  note: string;
  confidence: 'high' | 'medium' | 'low';
  flags: string[];
}
