require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const nodemailer = require('nodemailer');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const smtp = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
  connectionTimeout: 10000,
  greetingTimeout: 10000,
  socketTimeout: 20000,
});

async function sendViaGmailApi(to, subject, body) {
  const clientId = process.env.GMAIL_CLIENT_ID;
  const clientSecret = process.env.GMAIL_CLIENT_SECRET;
  const refreshToken = process.env.GMAIL_REFRESH_TOKEN;
  if (!clientId || !clientSecret || !refreshToken) throw new Error('Gmail OAuth env vars not set');
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: 'refresh_token' }),
  });
  if (!tokenRes.ok) throw new Error(`Token refresh failed: ${tokenRes.status}`);
  const { access_token } = await tokenRes.json();
  const from = process.env.GMAIL_USER;
  const raw = Buffer.from(`From: ${from}\r\nTo: ${to}\r\nSubject: ${subject}\r\nContent-Type: text/plain; charset=UTF-8\r\nMIME-Version: 1.0\r\n\r\n${body}`).toString('base64url');
  const sendRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: { Authorization: `Bearer ${access_token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ raw }),
  });
  if (!sendRes.ok) throw new Error(`Gmail send failed: ${sendRes.status} ${await sendRes.text()}`);
}

async function tg(text) {
  if (!process.env.TG_BOT_TOKEN || !process.env.TG_CHAT_ID) return;
  try {
    await fetch(`https://api.telegram.org/bot${process.env.TG_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: process.env.TG_CHAT_ID, text }),
    });
  } catch {}
}

async function main() {
  const { data, error } = await supabase
    .from('outreach')
    .select('*, leads(score)')
    .eq('status', 'draft')
    .not('to_email', 'is', null);

  if (error) throw new Error(`Supabase query failed: ${error.message}`);
  if (!data || data.length === 0) {
    console.log('No pending outreach drafts.');
    return;
  }

  const useApi = !!process.env.GMAIL_REFRESH_TOKEN;
  for (const row of data) {
    const score = row.leads?.score ?? 0;
    if (score < 6) {
      console.log(`SKIP ${row.to_email} (score ${score})`);
      continue;
    }
    try {
      if (useApi) {
        await sendViaGmailApi(row.to_email, row.subject, row.body);
      } else {
        await smtp.sendMail({ from: process.env.GMAIL_USER, to: row.to_email, subject: row.subject, text: row.body });
      }
      await supabase.from('outreach').update({ status: 'sent' }).eq('id', row.id);
      console.log(`SENT ${row.to_email}`);
      await tg(`✅ Email sent: ${row.subject} -> ${row.to_email}`);
    } catch (err) {
      await supabase.from('outreach').update({ status: 'failed' }).eq('id', row.id);
      console.log(`FAILED ${row.to_email}: ${err.message}`);
      await tg(`❌ Email failed: ${row.subject} -> ${row.to_email} (${err.message})`);
    }
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e.message); process.exit(1); });