import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { GmailApiService } from './gmail-api.service';

@Injectable()
export class MailService {
  private readonly transporter: nodemailer.Transporter | null = null;
  private readonly gmailApi: GmailApiService;

  constructor(gmailApi: GmailApiService) {
    this.gmailApi = gmailApi;
    const user = process.env.GMAIL_USER;
    const pass = process.env.GMAIL_APP_PASSWORD;
    if (user && pass) {
      this.transporter = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
        auth: { user, pass },
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 20000,
      });
    }
  }

  async send(to: string, subject: string, body: string): Promise<void> {
    if (process.env.GMAIL_REFRESH_TOKEN) {
      await this.gmailApi.send(to, subject, body);
      return;
    }
    if (!this.transporter) throw new Error('No mail transport configured (GMAIL_USER/APP_PASSWORD or GMAIL_REFRESH_TOKEN)');
    const from = process.env.GMAIL_USER!;
    await this.transporter.sendMail({
      from,
      to,
      subject,
      text: body,
    });
  }

  async diagnose(): Promise<string> {
    const net = await import('net');
    const results: string[] = [];
    const targets: Array<[string, number]> = [
      ['smtp.gmail.com', 587],
      ['smtp.gmail.com', 465],
      ['smtp-relay.brevo.com', 587],
      ['smtp.sendgrid.net', 587],
    ];
    for (const [host, port] of targets) {
      await new Promise<void>((resolve) => {
        const s = net.connect(port, host);
        let done = false;
        const finish = (msg: string) => { if (!done) { done = true; results.push(`${host}:${port} ${msg}`); s.destroy(); resolve(); } };
        s.on('connect', () => finish('CONNECT OK'));
        s.on('error', (e) => finish(`ERR ${e.message}`));
        s.setTimeout(8000, () => finish('TIMEOUT'));
      });
    }
    return results.join(' | ');
  }
}