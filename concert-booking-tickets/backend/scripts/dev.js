import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

const root = fileURLToPath(new URL('../', import.meta.url));
dotenv.config({ path: fileURLToPath(new URL('../.env', import.meta.url)), quiet: true });
const children = new Set();
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  process.exitCode = code;
  for (const child of children) child.kill();
}
function launch(args, extraEnv = {}) {
  const child = spawn(process.execPath, args, {
    cwd: root,
    env: { ...process.env, ...extraEnv },
    stdio: 'inherit',
    windowsHide: true,
  });
  children.add(child);
  child.on('error', (error) => {
    console.error(error.message);
    stop(1);
  });
  child.on('exit', (code) => {
    children.delete(child);
    if (!stopping) stop(code ?? 1);
  });
  return child;
}
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => stop());

async function databaseReady() {
  const connection = mongoose.createConnection(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 1000,
  });
  try {
    await connection.asPromise();
    const hello = await connection.db.admin().command({ hello: 1 });
    return hello.isWritablePrimary && (hello.setName || hello.msg === 'isdbgrid');
  } catch {
    return false;
  } finally {
    await connection.close().catch(() => {});
  }
}

try {
  const uri = new URL(process.env.MONGODB_URI);
  // Only manage the replica set owned by this project's local-db script.
  const local = process.env.NODE_ENV !== 'production' &&
    uri.protocol === 'mongodb:' && ['127.0.0.1', 'localhost'].includes(uri.hostname) &&
    uri.port === '27018' && uri.searchParams.get('replicaSet') === 'rs0' &&
    !uri.username && !uri.password;
  if (local && !(await databaseReady())) {
    console.log('Starting the project local MongoDB replica set...');
    launch(['scripts/local-db.js'], { MONGO_PORT: uri.port });
    let ready = false;
    for (let attempt = 0; attempt < 60 && !stopping; attempt++) {
      if (await databaseReady()) { ready = true; break; }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    if (!ready) throw new Error('Local MongoDB could not start. Check the database output above.');
  }
  if (!stopping) launch(['--watch', 'src/server.js']);
} catch (error) {
  console.error(process.env.MONGODB_URI ? error.message : 'Missing backend/.env. Run npm run setup first.');
  stop(1);
}
