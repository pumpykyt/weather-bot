import * as fs from 'fs';
import * as path from 'path';
import type { CalibrationData, CalibrationEntry } from './types';

const CALIBRATION_PATH = path.join(process.cwd(), 'data', 'calibration.json');

// Default sigma per source (degrees F or C depending on city unit)
export const DEFAULT_SIGMA: Record<string, number> = {
  ecmwf: 5.0,
  hrrr:  3.5,
  metar: 2.0,
};

export function loadCalibration(): CalibrationData {
  if (!fs.existsSync(CALIBRATION_PATH)) return {};
  try {
    return JSON.parse(fs.readFileSync(CALIBRATION_PATH, 'utf-8'));
  } catch {
    return {};
  }
}

export function saveCalibration(data: CalibrationData): void {
  fs.writeFileSync(CALIBRATION_PATH, JSON.stringify(data, null, 2));
}

export function getCalibratedSigma(
  calibration: CalibrationData,
  city: string,
  source: string,
  calibrationMin: number,
): number | undefined {
  const entry = calibration[city]?.[source];
  if (!entry || entry.count < calibrationMin) return undefined;
  return entry.sigma;
}

export function recordResolution(
  calibration: CalibrationData,
  city: string,
  source: string,
  forecastTemp: number,
  actualTemp: number,
  calibrationMin: number,
): CalibrationData {
  if (!calibration[city]) calibration[city] = {};
  if (!calibration[city][source]) {
    calibration[city][source] = { mae: 0, count: 0, sigma: DEFAULT_SIGMA[source] ?? 5.0 };
  }

  const entry = calibration[city][source];
  const error = Math.abs(forecastTemp - actualTemp);

  // Incremental MAE update
  entry.mae = (entry.mae * entry.count + error) / (entry.count + 1);
  entry.count += 1;

  // Recalibrate sigma once we have enough samples
  if (entry.count >= calibrationMin) {
    // Sigma ≈ 1.25 * MAE for a normal distribution (approximation)
    entry.sigma = Math.max(1.0, entry.mae * 1.25);
  }

  return calibration;
}
