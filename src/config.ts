import * as fs from 'fs';
import * as path from 'path';
import type { BotConfig, CityConfig } from './types';

const CONFIG_PATH = path.join(process.cwd(), 'config.json');

const DEFAULTS: BotConfig = {
  balance: 10000.0,
  maxBet: 20.0,
  minEv: 0.1,
  maxPrice: 0.45,
  minVolume: 500,
  minHours: 2.0,
  maxHours: 72.0,
  kellyFraction: 0.25,
  scanInterval: 3600,
  calibrationMin: 30,
  maxSlippage: 0.03,
  vcKey: '',
  polymarketApiKey: '',
  paperTrading: true,
};

export function loadConfig(): BotConfig {
  if (!fs.existsSync(CONFIG_PATH)) {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(DEFAULTS, null, 2));
    console.log('[config] Created default config.json');
    return DEFAULTS;
  }
  const raw = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
  return { ...DEFAULTS, ...raw };
}

// Names must match exactly how Polymarket titles them (checked against live API)
export const CITIES: CityConfig[] = [
  // US — Fahrenheit
  { name: 'New York City', polymarketName: 'NYC', lat: 40.7769,  lon: -73.8740,  airportCode: 'KLGA', timezone: 'America/New_York',    unit: 'fahrenheit', country: 'US' },
  { name: 'Chicago',       lat: 41.9742,  lon: -87.9073,  airportCode: 'KORD', timezone: 'America/Chicago',     unit: 'fahrenheit', country: 'US' },
  { name: 'Los Angeles',   lat: 33.9425,  lon: -118.408,  airportCode: 'KLAX', timezone: 'America/Los_Angeles', unit: 'fahrenheit', country: 'US' },
  { name: 'Houston',       lat: 29.9902,  lon: -95.3368,  airportCode: 'KIAH', timezone: 'America/Chicago',     unit: 'fahrenheit', country: 'US' },
  { name: 'Miami',         lat: 25.7959,  lon: -80.2870,  airportCode: 'KMIA', timezone: 'America/New_York',    unit: 'fahrenheit', country: 'US' },
  { name: 'San Francisco', lat: 37.6213,  lon: -122.379,  airportCode: 'KSFO', timezone: 'America/Los_Angeles', unit: 'fahrenheit', country: 'US' },
  { name: 'Dallas',        lat: 32.8998,  lon: -97.0403,  airportCode: 'KDFW', timezone: 'America/Chicago',     unit: 'fahrenheit', country: 'US' },
  { name: 'Atlanta',       lat: 33.6407,  lon: -84.4277,  airportCode: 'KATL', timezone: 'America/New_York',    unit: 'fahrenheit', country: 'US' },
  { name: 'Seattle',       lat: 47.4502,  lon: -122.309,  airportCode: 'KSEA', timezone: 'America/Los_Angeles', unit: 'fahrenheit', country: 'US' },
  { name: 'Phoenix',       lat: 33.4373,  lon: -112.008,  airportCode: 'KPHX', timezone: 'America/Phoenix',     unit: 'fahrenheit', country: 'US' },
  { name: 'Denver',        lat: 39.8561,  lon: -104.676,  airportCode: 'KDEN', timezone: 'America/Denver',      unit: 'fahrenheit', country: 'US' },
  { name: 'Austin',        lat: 30.1975,  lon: -97.6664,  airportCode: 'KAUS', timezone: 'America/Chicago',     unit: 'fahrenheit', country: 'US' },
  // Canada
  { name: 'Toronto',       lat: 43.6777,  lon: -79.6248,  airportCode: 'CYYZ', timezone: 'America/Toronto',     unit: 'celsius',    country: 'CA' },
  // Europe — Celsius
  { name: 'London',        lat: 51.4775,  lon: -0.4614,   airportCode: 'EGLL', timezone: 'Europe/London',       unit: 'celsius',    country: 'UK' },
  { name: 'Paris',         lat: 49.0097,  lon: 2.5479,    airportCode: 'LFPG', timezone: 'Europe/Paris',        unit: 'celsius',    country: 'FR' },
  { name: 'Berlin',        lat: 52.5597,  lon: 13.2877,   airportCode: 'EDDB', timezone: 'Europe/Berlin',       unit: 'celsius',    country: 'DE' },
  { name: 'Milan',         lat: 45.4654,  lon: 9.1859,    airportCode: 'LIML', timezone: 'Europe/Rome',         unit: 'celsius',    country: 'IT' },
  { name: 'Madrid',        lat: 40.4983,  lon: -3.5676,   airportCode: 'LEMD', timezone: 'Europe/Madrid',       unit: 'celsius',    country: 'ES' },
  { name: 'Amsterdam',     lat: 52.3105,  lon: 4.7683,    airportCode: 'EHAM', timezone: 'Europe/Amsterdam',    unit: 'celsius',    country: 'NL' },
  { name: 'Warsaw',        lat: 52.1657,  lon: 20.9671,   airportCode: 'EPWA', timezone: 'Europe/Warsaw',       unit: 'celsius',    country: 'PL' },
  { name: 'Helsinki',      lat: 60.3183,  lon: 24.9497,   airportCode: 'EFHK', timezone: 'Europe/Helsinki',     unit: 'celsius',    country: 'FI' },
  { name: 'Istanbul',      lat: 40.9769,  lon: 28.8146,   airportCode: 'LTFM', timezone: 'Europe/Istanbul',     unit: 'celsius',    country: 'TR' },
  { name: 'Moscow',        lat: 55.9726,  lon: 37.4146,   airportCode: 'UUEE', timezone: 'Europe/Moscow',       unit: 'celsius',    country: 'RU' },
  { name: 'Ankara',        lat: 40.1281,  lon: 32.9951,   airportCode: 'LTAC', timezone: 'Europe/Istanbul',     unit: 'celsius',    country: 'TR' },
  // Asia — Celsius
  { name: 'Tokyo',         lat: 35.7647,  lon: 140.386,   airportCode: 'RJAA', timezone: 'Asia/Tokyo',          unit: 'celsius',    country: 'JP' },
  { name: 'Hong Kong',     lat: 22.3089,  lon: 113.915,   airportCode: 'VHHH', timezone: 'Asia/Hong_Kong',      unit: 'celsius',    country: 'HK' },
  { name: 'Shanghai',      lat: 31.1443,  lon: 121.805,   airportCode: 'ZSPD', timezone: 'Asia/Shanghai',       unit: 'celsius',    country: 'CN' },
  { name: 'Beijing',       lat: 40.0799,  lon: 116.584,   airportCode: 'ZBAA', timezone: 'Asia/Shanghai',       unit: 'celsius',    country: 'CN' },
  { name: 'Chengdu',       lat: 30.5785,  lon: 103.947,   airportCode: 'ZUUU', timezone: 'Asia/Shanghai',       unit: 'celsius',    country: 'CN' },
  { name: 'Chongqing',     lat: 29.7192,  lon: 106.642,   airportCode: 'ZUCK', timezone: 'Asia/Shanghai',       unit: 'celsius',    country: 'CN' },
  { name: 'Wuhan',         lat: 30.7836,  lon: 114.208,   airportCode: 'ZHHH', timezone: 'Asia/Shanghai',       unit: 'celsius',    country: 'CN' },
  { name: 'Shenzhen',      lat: 22.6399,  lon: 113.811,   airportCode: 'ZGSZ', timezone: 'Asia/Shanghai',       unit: 'celsius',    country: 'CN' },
  { name: 'Taipei',        lat: 25.0777,  lon: 121.233,   airportCode: 'RCTP', timezone: 'Asia/Taipei',         unit: 'celsius',    country: 'TW' },
  { name: 'Seoul',         lat: 37.4602,  lon: 126.441,   airportCode: 'RKSI', timezone: 'Asia/Seoul',          unit: 'celsius',    country: 'KR' },
  { name: 'Busan',         lat: 35.1796,  lon: 129.076,   airportCode: 'RKPK', timezone: 'Asia/Seoul',          unit: 'celsius',    country: 'KR' },
  { name: 'Singapore',     lat: 1.3644,   lon: 103.991,   airportCode: 'WSSS', timezone: 'Asia/Singapore',      unit: 'celsius',    country: 'SG' },
  { name: 'Tel Aviv',      lat: 32.0114,  lon: 34.8867,   airportCode: 'LLBG', timezone: 'Asia/Jerusalem',      unit: 'celsius',    country: 'IL' },
  { name: 'Lucknow',       lat: 26.7606,  lon: 80.8893,   airportCode: 'VILK', timezone: 'Asia/Kolkata',        unit: 'celsius',    country: 'IN' },
  // Oceania / Pacific
  { name: 'Sydney',        lat: -33.9399, lon: 151.175,   airportCode: 'YSSY', timezone: 'Australia/Sydney',    unit: 'celsius',    country: 'AU' },
  { name: 'Wellington',    lat: -41.3272, lon: 174.805,   airportCode: 'NZWN', timezone: 'Pacific/Auckland',    unit: 'celsius',    country: 'NZ' },
  // Americas
  { name: 'Mexico City',   lat: 19.4363,  lon: -99.0721,  airportCode: 'MMMX', timezone: 'America/Mexico_City', unit: 'celsius',    country: 'MX' },
  { name: 'Sao Paulo',     lat: -23.4356, lon: -46.4731,  airportCode: 'SBGR', timezone: 'America/Sao_Paulo',   unit: 'celsius',    country: 'BR' },
  { name: 'Buenos Aires',  lat: -34.8222, lon: -58.5358,  airportCode: 'SAEZ', timezone: 'America/Argentina/Buenos_Aires', unit: 'celsius', country: 'AR' },
];
