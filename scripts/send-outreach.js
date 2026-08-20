require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const nodemailer = require('nodemailer');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
  connectionTimeout: 10000,
  greetingTimeout: 10000,
  socketTimeout: 20000,
});

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

  for (const row of data) {
    const score = row.leads?.score ?? 0;
    if (score < 6) {
      console.log(`SKIP ${row.to_email} (score ${score})`);
      continue;
    }
    try {
      await transporter.sendMail({
        from: process.env.GMAIL_USER,
        to: row.to_email,
        subject: row.subject,
        text: row.body,
      });
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