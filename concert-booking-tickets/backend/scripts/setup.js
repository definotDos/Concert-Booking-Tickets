import fs from 'node:fs';
import crypto from 'node:crypto';
if (fs.existsSync('.env')) {
  console.log('.env already exists; no changes made.');
  process.exit(0);
}
const secret = () => crypto.randomBytes(32).toString('hex');
fs.writeFileSync(
  '.env',
  `PORT=4000\nMONGODB_URI=mongodb://127.0.0.1:27018/concert_booking?replicaSet=rs0\nFRONTEND_URL=http://localhost:5173\nNODE_ENV=development\nSESSION_DAYS=7\nHOLD_MINUTES=10\nPAYMENT_PROVIDER=sandbox\nTICKET_SECRET=${secret()}\nSANDBOX_SECRET=${secret()}\nADMIN_EMAIL=admin@example.test\nADMIN_PASSWORD=${secret()}\n`,
  { mode: 0o600 },
);
console.log(
  'Created ignored backend/.env with unique local secrets. Read ADMIN_EMAIL and ADMIN_PASSWORD there to access the seeded administrator.',
);
