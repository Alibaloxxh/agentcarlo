require('dotenv').config();

const BASE = (process.env.RAILWAY_PUBLIC_DOMAIN || 'http://localhost:8080').replace(/^https?:\/\//, '') + '';

async function hit(path) {
  const r = await fetch(`https://${BASE}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  const text = await r.text();
  console.log(`${new Date().toISOString()} ${path} -> ${r.status} ${text.slice(0, 500)}`);
}

(async () => {
  await hit('/agent/scan-leads');
})().catch((e) => { console.error(e.message); process.exit(1); });