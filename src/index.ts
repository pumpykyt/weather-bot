import 'dotenv/config';
import * as cron from 'node-cron';
import { loadConfig } from './config';
import { fullScan, quickCheck, printStats } from './bot';

async function main() {
  const config = loadConfig();

  console.log('=== WeatherBot TypeScript ===');
  console.log(`Mode:          ${config.paperTrading ? 'PAPER' : 'LIVE'}`);
  console.log(`Hermes:        ${process.env.HERMES_MODEL ?? 'hermes3'} @ ${process.env.HERMES_BASE_URL ?? 'http://localhost:11434'}`);
  console.log(`Balance:       $${config.balance}`);
  console.log(`Max bet:       $${config.maxBet}`);
  console.log(`Min EV:        ${config.minEv}`);
  console.log('');

  const args = process.argv.slice(2);

  // One-shot modes
  if (args.includes('--scan')) {
    await fullScan(config);
    await printStats(config);
    return;
  }
  if (args.includes('--check')) {
    await quickCheck(config);
    return;
  }
  if (args.includes('--stats')) {
    await printStats(config);
    return;
  }

  // Continuous loop mode
  console.log('[bot] Starting continuous loop...');
  console.log(`[bot] Full scan every ${config.scanInterval}s, quick check every 600s`);

  // Initial run
  await fullScan(config);
  await printStats(config);

  // Full scan: every scanInterval seconds (default 60min)
  const scanMinutes = Math.floor(config.scanInterval / 60);
  cron.schedule(`*/${scanMinutes} * * * *`, async () => {
    await fullScan(config);
  });

  // Quick position check: every 10 minutes
  cron.schedule('*/10 * * * *', async () => {
    await quickCheck(config);
  });

  // Stats summary: every hour at :05
  cron.schedule('5 * * * *', async () => {
    await printStats(config);
  });
}

main().catch(err => {
  console.error('[fatal]', err);
  process.exit(1);
});
