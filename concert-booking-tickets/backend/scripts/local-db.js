import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import mongoose from 'mongoose';
const port = Number(process.env.MONGO_PORT || 27018);
const dbpath = path.resolve(`.local/mongodb-${port}`);
fs.mkdirSync(dbpath, { recursive: true });
const child = spawn(
  'mongod',
  [
    '--dbpath',
    dbpath,
    '--replSet',
    'rs0',
    '--bind_ip',
    '127.0.0.1',
    '--port',
    String(port),
    '--logpath',
    path.join(dbpath, 'mongod.log'),
    '--logappend',
  ],
  { stdio: 'inherit', windowsHide: true },
);
let exited = false;
child.on('error', (e) => {
  console.error(
    `Cannot start mongod: ${e.message}. Install MongoDB Community Server and add mongod to PATH.`,
  );
  process.exit(1);
});
child.on('exit', (code) => {
  exited = true;
  process.exit(code || 0);
});
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill());
for (let attempt = 0; attempt < 60 && !exited; attempt++) {
  try {
    await mongoose.connect(`mongodb://127.0.0.1:${port}/admin?directConnection=true`, {
      serverSelectionTimeoutMS: 1000,
    });
    const admin = mongoose.connection.db.admin();
    try {
      await admin.command({ replSetGetStatus: 1 });
    } catch (e) {
      if (e.code === 94)
        await admin.command({
          replSetInitiate: { _id: 'rs0', members: [{ _id: 0, host: `127.0.0.1:${port}` }] },
        });
      else throw e;
    }
    const hello = await admin.command({ hello: 1 });
    if (hello.isWritablePrimary) {
      await mongoose.disconnect();
      console.log(`Local replica set ready on port ${port}. Keep this terminal open.`);
      break;
    }
  } catch (e) {
    if (attempt === 59) {
      console.error(e.message);
      child.kill();
      process.exitCode = 1;
    }
  }
  await mongoose.disconnect();
  await new Promise((resolve) => setTimeout(resolve, 500));
}
