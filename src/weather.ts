import axios from 'axios';
import type { CityConfig, ForecastSnapshot } from './types';

const OPEN_METEO_BASE = 'https://api.open-meteo.com/v1';
const METAR_BASE = 'https://aviationweather.gov/api/data/metar';

interface OpenMeteoResponse {
  hourly?: {
    time: string[];
    temperature_2m: number[];
  };
  daily?: {
    time: string[];
    temperature_2m_max: number[];
  };
}

interface MetarResponse {
  temp: number | null;
}

function celsiusToFahrenheit(c: number): number {
  return c * 9 / 5 + 32;
}

function getTargetHour(targetDate: string, timezone: string): string {
  // Returns the target UTC datetime string for peak-of-day (15:00 local)
  const dt = new Date(`${targetDate}T15:00:00`);
  return dt.toISOString().slice(0, 13);
}

async function fetchECMWF(city: CityConfig, targetDate: string): Promise<number | null> {
  try {
    const url = `${OPEN_METEO_BASE}/forecast`;
    const params = {
      latitude: city.lat,
      longitude: city.lon,
      daily: 'temperature_2m_max',
      temperature_unit: city.unit,
      timezone: city.timezone,
      start_date: targetDate,
      end_date: targetDate,
      models: 'ecmwf_ifs025',
    };

    const res = await axios.get<OpenMeteoResponse>(url, { params, timeout: 10000 });
    const data = res.data;

    if (data.daily?.temperature_2m_max?.length) {
      return data.daily.temperature_2m_max[0];
    }
    return null;
  } catch (err) {
    console.warn(`[weather] ECMWF fetch failed for ${city.name}:`, (err as Error).message);
    return null;
  }
}

async function fetchHRRR(city: CityConfig, targetDate: string): Promise<number | null> {
  // HRRR only covers US cities and is only accurate within 48h
  if (city.country !== 'US') return null;

  const target = new Date(targetDate);
  const now = new Date();
  const hoursAway = (target.getTime() - now.getTime()) / 3600000;
  if (hoursAway > 48) return null;

  try {
    const url = `${OPEN_METEO_BASE}/forecast`;
    const params = {
      latitude: city.lat,
      longitude: city.lon,
      hourly: 'temperature_2m',
      temperature_unit: city.unit,
      timezone: city.timezone,
      start_date: targetDate,
      end_date: targetDate,
      models: 'gfs_seamless',
    };

    const res = await axios.get<OpenMeteoResponse>(url, { params, timeout: 10000 });
    const data = res.data;

    if (!data.hourly) return null;

    const { time, temperature_2m } = data.hourly;
    // Find max temp for the day (represents daily high)
    if (!temperature_2m.length) return null;
    return Math.max(...temperature_2m);
  } catch (err) {
    console.warn(`[weather] HRRR fetch failed for ${city.name}:`, (err as Error).message);
    return null;
  }
}

async function fetchMETAR(city: CityConfig): Promise<number | null> {
  try {
    const res = await axios.get<string>(METAR_BASE, {
      params: { ids: city.airportCode, format: 'json', taf: false, hours: 1 },
      timeout: 8000,
    });

    // aviationweather returns array of METAR objects
    const metars = res.data as unknown as Array<{ temp?: number }>;
    if (!Array.isArray(metars) || !metars.length) return null;

    const tempC = metars[0].temp;
    if (tempC == null) return null;

    return city.unit === 'fahrenheit' ? celsiusToFahrenheit(tempC) : tempC;
  } catch (err) {
    console.warn(`[weather] METAR fetch failed for ${city.name}:`, (err as Error).message);
    return null;
  }
}

export async function getForecastSnapshot(
  city: CityConfig,
  targetDate: string,
  hoursUntilResolution: number,
  defaultSigma: number,
  calibratedSigma?: number,
): Promise<ForecastSnapshot | null> {
  const [ecmwf, hrrr, metar] = await Promise.all([
    fetchECMWF(city, targetDate),
    fetchHRRR(city, targetDate),
    fetchMETAR(city),
  ]);

  let temperature: number;
  let source: ForecastSnapshot['source'];

  // Priority: HRRR (highest resolution short-term) > ECMWF > METAR fallback
  if (hrrr !== null) {
    temperature = hrrr;
    source = 'hrrr';
  } else if (ecmwf !== null) {
    temperature = ecmwf;
    source = 'ecmwf';
  } else if (metar !== null) {
    temperature = metar;
    source = 'metar';
  } else {
    console.warn(`[weather] No forecast available for ${city.name} on ${targetDate}`);
    return null;
  }

  const sigma = calibratedSigma ?? defaultSigma;

  return {
    city: city.name,
    date: targetDate,
    temperature,
    source,
    sigma,
    fetchedAt: new Date().toISOString(),
    hoursUntilResolution,
  };
}
