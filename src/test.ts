import 'dotenv/config';
import { loadConfig, CITIES } from './config';
import { getForecastSnapshot } from './weather';
import { fetchAllWeatherEvents, searchWeatherMarkets, getMarketsByEvent, parseMarketOutcomes, parseTemperatureBucket } from './polymarket';
import { DEFAULT_SIGMA } from './calibration';
import { fetchActualTemp } from './visualcrossing';

async function main() {
  const config = loadConfig();
  const city = CITIES[0]; // New York City
  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

  console.log('\n--- 1. Weather fetch test (New York City) ---');
  const snap = await getForecastSnapshot(city, tomorrow, 24, DEFAULT_SIGMA['ecmwf'] ?? 5);
  if (snap) {
    console.log(`OK: ${snap.city} ${snap.date} = ${snap.temperature.toFixed(1)}° via ${snap.source} (sigma=${snap.sigma})`);
  } else {
    console.log('FAIL: No forecast returned');
  }

  console.log('\n--- 2. Regex parse test (sample market questions) ---');
  const samples = [
    'Will the highest temperature in New York City be 57°F or below on May 22?',
    'Will the highest temperature in New York City be between 58-59°F on May 22?',
    'Will the highest temperature in New York City be between 60-61°F on May 22?',
    'Will the highest temperature in London be 20°C or below on May 22?',
    'Will the highest temperature in London be 21°C on May 22?',
    'Will the highest temperature in Shanghai be 22°C on May 22?',
  ];
  samples.forEach(q => {
    const b = parseTemperatureBucket(q);
    console.log(`  "${q.slice(0, 60)}..." => ${b ? `[${b.min}–${b.max}]` : 'NULL'}`);
  });

  console.log('\n--- 3. Polymarket weather events fetch ---');
  const allEvents = await fetchAllWeatherEvents();
  console.log(`Total temperature events: ${allEvents.length}`);
  allEvents.slice(0, 5).forEach(e => console.log(`  - ${e.title} (ends: ${e.endDate})`));

  console.log('\n--- 4. City market search test ---');
  const nycEvents = await searchWeatherMarkets(city.polymarketName ?? city.name, '');
  console.log(`"New York City" events: ${nycEvents.length}`);
  if (nycEvents.length > 0) {
    const markets = await getMarketsByEvent(nycEvents[0].id);
    const outcomes = await parseMarketOutcomes(markets);
    console.log(`  Event: "${nycEvents[0].title}" → ${markets.length} markets, ${outcomes.length} parsed buckets`);
    outcomes.slice(0, 4).forEach(o =>
      console.log(`    [${o.bucket.min}–${o.bucket.max}°] ask=${o.bestAsk?.toFixed(3)} vol=${o.volume}`)
    );
  }

  console.log('\n--- 5. Visual Crossing test ---');
  const actual = await fetchActualTemp(city.lat, city.lon, today, config.vcKey, city.unit);
  if (actual !== null) {
    console.log(`OK: actual high for ${city.name} on ${today} = ${actual.toFixed(1)}°`);
  } else {
    console.log('FAIL or no key set');
  }
}

main().catch(console.error);
