require('dotenv').config();
const http = require('http');
const { spawn } = require('child_process');

const clientId = process.env.GMAIL_CLIENT_ID;
const clientSecret = process.env.GMAIL_CLIENT_SECRET;
if (!clientId || !clientSecret) {
  console.error('Set GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET in .env first (Google Cloud OAuth client).');
  process.exit(1);
}

const PORT = 8123;
const redirectUri = `http://127.0.0.1:${PORT}/callback`;

const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${new URLSearchParams({
  client_id: clientId,
  redirect_uri: redirectUri,
  response_type: 'code',
  scope: 'https://www.googleapis.com/auth/gmail.send',
  access_type: 'offline',
  prompt: 'consent',
})}`;

console.log('\nAuth URL (copy-paste into browser if it does not open):\n' + authUrl + '\n');

const server = http.createServer(async (req, res) => {
    console.log('\nINCOMING:', req.method, req.url);
    const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
    if (url.pathname === '/callback') {
      const code = url.searchParams.get('code');
      const err = url.searchParams.get('error');
      if (code) {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end('<h3>Authorized — close this tab.</h3>');
        server.close();
        try {
          const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
              code,
              client_id: clientId,
              client_secret: clientSecret,
              redirect_uri: redirectUri,
              grant_type: 'authorization_code',
            }),
          });
          const data = await tokenRes.json();
          if (!tokenRes.ok) console.error('Token exchange error body:', JSON.stringify(data));
          if (!data.refresh_token) {
            console.error('No refresh_token returned. Body:', JSON.stringify(data));
            process.exit(1);
          }
          console.log('\nREFRESH_TOKEN=' + data.refresh_token);
          console.log('\nAdd this to Railway (GMAIL_REFRESH_TOKEN) and local .env. Keep it secret.');
          process.exit(0);
        } catch (e) {
          console.error('Token exchange failed:', e.message);
          process.exit(1);
        }
      } else {
        console.log('callback with', err ? `error=${err}` : 'NO code and NO error', '— waiting for real redirect...');
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end('<h3>Waiting for code — if this is a stale tab, close it.</h3>');
      }
    } else {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<h3>OK</h3>');
    }
});

server.listen(PORT, () => {
  console.log('Opening browser for Gmail authorization...');
  spawn('cmd', ['/c', 'start', '', `"${authUrl}"`], { detached: true, stdio: 'ignore' }).unref();
  console.log(`Waiting for redirect on http://127.0.0.1:${PORT}/callback`);
});
