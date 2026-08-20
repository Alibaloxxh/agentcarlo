require('dotenv').config();

const BASE = (process.env.RAILWAY_PUBLIC_DOMAIN || 'http://localhost:8080').replace(/^https?:\/\//, '') + '';

(async () => {
  const r = await fetch(`https://${BASE}/agent/hunt-search`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  const text = await r.text();
  console.log(`${new Date().toISOString()} hunt-search -> ${r.status} ${text.slice(0, 800)}`);
})().catch((e) => { console.error(e.message); process.exit(1); });