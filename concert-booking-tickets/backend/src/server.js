import mongoose from 'mongoose';
import { env } from './config/env.js';
import { app } from './app.js';
import { expireHolds } from './services/bookings.js';
import * as models from './models/index.js';
await mongoose.connect(env.MONGODB_URI);
const hello = await mongoose.connection.db.admin().command({ hello: 1 });
if (!hello.setName && hello.msg !== 'isdbgrid')
  throw new Error('MongoDB must be a replica set. Run npm run db:local or use Atlas.');
await Promise.all(Object.values(models).map((model) => model.init()));
await expireHolds();
let cleaning = false;
const timer = setInterval(async () => {
  if (cleaning) return;
  cleaning = true;
  try {
    await expireHolds();
  } catch (e) {
    console.error('Hold cleanup failed', e.message);
  } finally {
    cleaning = false;
  }
}, 15000);
const server = app.listen(env.PORT, () =>
  console.log(`Concert API ready at http://localhost:${env.PORT}`),
);
for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, () => {
    clearInterval(timer);
    server.close(async () => {
      await mongoose.disconnect();
      process.exit(0);
    });
  });
