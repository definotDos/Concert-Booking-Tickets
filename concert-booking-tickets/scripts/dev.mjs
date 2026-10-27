import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import concurrently from 'concurrently';

const root = fileURLToPath(new URL('../', import.meta.url));
const requireBackend = createRequire(path.join(root, 'backend/package.json'));
requireBackend('dotenv').config({ path: path.join(root, 'backend/.env'), quiet: true });
const apiPort = Number(process.env.PORT || 4000);
const frontendUrl = new URL(process.env.FRONTEND_URL || 'http://localhost:5173');
const webPort = Number(frontendUrl.port || 80);

async function listening(port, host) {
  return new Promise((resolve) => {
    const socket = net.connect({ port, host });
    socket.setTimeout(1500);
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('error', () => {
      socket.destroy();
      resolve(false);
    });
    socket.once('timeout', () => {
      socket.destroy();
      resolve(false);
    });
  });
}

async function json(url) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(3000) });
    return response.ok ? await response.json() : null;
  } catch {
    return null;
  }
}

try {
  if (
    frontendUrl.protocol !== 'http:' ||
    !['localhost', '127.0.0.1'].includes(frontendUrl.hostname)
  )
    throw new Error(
      'Local development requires an http://localhost or http://127.0.0.1 FRONTEND_URL.',
    );
  const commands = [];
  const health = await json(`http://127.0.0.1:${apiPort}/api/health`);
  if (health?.status === 'ok' && ['sandbox', 'stripe'].includes(health.paymentProvider)) {
    console.log(`[API] Reusing the running Concert API on port ${apiPort}.`);
  } else if (await listening(apiPort, '127.0.0.1')) {
    throw new Error(
      `Port ${apiPort} is occupied by an unrecognized or unhealthy API. Stop its original terminal and retry.`,
    );
  } else {
    commands.push({ name: 'API', command: 'npm run dev --prefix backend' });
  }

  const web = await json(`${frontendUrl.origin}/__concert_dev`);
  if (web?.root === path.resolve(root, 'frontend')) {
    console.log(`[WEB] Reusing this checkout's frontend at ${frontendUrl.origin}.`);
  } else if (await listening(webPort, frontendUrl.hostname)) {
    throw new Error(
      `Port ${webPort} is occupied by another server. Stop that server in its original terminal, then run npm run dev again.`,
    );
  } else {
    commands.push({ name: 'WEB', command: 'npm run dev --prefix frontend' });
  }

  console.log(`Open ${frontendUrl.origin}. The backend manages the default local database automatically.`);
  if (commands.length) {
    console.log(
      'Ctrl+C stops services started here. Reused services stay in their original terminals.',
    );
    const { result } = concurrently(commands, {
      cwd: root,
      killOthers: ['failure', 'success'],
    });
    await result;
  } else {
    console.log('Both services are already running; no duplicate processes were started.');
  }
} catch (error) {
  console.error(
    error instanceof Error
      ? error.message
      : 'A development service stopped. Check the API/WEB output above.',
  );
  process.exitCode = 1;
}
