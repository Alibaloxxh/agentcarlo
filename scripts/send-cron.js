require('dotenv').config();

(async () => {
  const r = await fetch(`https://agentcarlo-production.up.railway.app/agent/send-outreach`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  });
  const text = await r.text();
  console.log(`${new Date().toISOString()} send-outreach -> ${r.status} ${text.slice(0, 500)}`);
})().catch((e) => { console.error(e.message); process.exit(1); });