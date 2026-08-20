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
      service: 'gmail',
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
}