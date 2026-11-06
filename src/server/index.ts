import { resolve } from 'node:path';
import { getContentPack } from '../content/index.js';
import { createLlmClient, readLlmEnv } from '../llm/index.js';
import { createApp } from './app.js';
import { loadEnvFile } from './env.js';
import { Store } from './store.js';

loadEnvFile();

const port = Number.parseInt(process.env.PORT ?? '8787', 10);
const dataFile = resolve(process.env.DATA_FILE ?? 'data/abhyas.json');
const content = await getContentPack();
const llm = createLlmClient(readLlmEnv());
const store = new Store(dataFile);
const app = createApp({ store, content, llm });

const server = app.listen(port, () => {
  console.log('');
  console.log('  अभ्यास · Abhyas server');
  console.log(`  http://localhost:${port}`);
  console.log(`  engine: ${llm.engine} (${llm.mode})${llm.fallback ? ' · mock fallback on' : ''}`);
  console.log(`  rubric: ${content.rubric.id} v${content.rubric.version} · ${content.rubric.hash?.slice(0, 12)}`);
  console.log(`  content: ${content.scenarios.length} scenarios · ${content.packVersion}`);
  console.log(`  data: ${dataFile}`);
  console.log('');
});

async function shutdown(signal: string): Promise<void> {
  console.log(`\n[abhyas] ${signal} received — flushing practice data…`);
  server.close();
  await store.flush();
  process.exit(0);
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
