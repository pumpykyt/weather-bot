import axios from 'axios';

const VC_BASE = 'https://weather.visualcrossing.com/VisualCrossingWebServices/rest/services/timeline';

interface VCDay {
  datetime: string;
  tempmax: number;
}

interface VCResponse {
  days: VCDay[];
}

export async function fetchActualTemp(
  lat: number,
  lon: number,
  date: string,
  vcKey: string,
  unit: 'fahrenheit' | 'celsius',
): Promise<number | null> {
  if (!vcKey) return null;

  try {
    const unitGroup = unit === 'fahrenheit' ? 'us' : 'metric';
    const res = await axios.get<VCResponse>(
      `${VC_BASE}/${lat},${lon}/${date}/${date}`,
      {
        params: { unitGroup, key: vcKey, include: 'days', elements: 'datetime,tempmax' },
        timeout: 10000,
      }
    );

    return res.data?.days?.[0]?.tempmax ?? null;
  } catch (err) {
    console.warn(`[visualcrossing] fetch failed for ${lat},${lon} on ${date}:`, (err as Error).message);
    return null;
  }
}
