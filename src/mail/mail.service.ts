import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private readonly transporter: nodemailer.Transporter;

  constructor() {
    const user = process.env.GMAIL_USER;
    const pass = process.env.GMAIL_APP_PASSWORD;
    if (!user || !pass) {
      throw new Error('GMAIL_USER / GMAIL_APP_PASSWORD not set — check .env');
    }
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

  async send(to: string, subject: string, body: string): Promise<void> {
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
    for (const port of [465, 587, 25]) {
      await new Promise<void>((resolve) => {
        const s = net.connect(port, 'smtp.gmail.com');
        let done = false;
        const finish = (msg: string) => { if (!done) { done = true; results.push(`${port}: ${msg}`); s.destroy(); resolve(); } };
        s.on('connect', () => finish('CONNECT OK'));
        s.on('error', (e) => finish(`ERR ${e.message}`));
        s.setTimeout(8000, () => finish('TIMEOUT'));
      });
    }
    return results.join(' | ');
  }
}