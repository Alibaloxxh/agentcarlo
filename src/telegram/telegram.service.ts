import { Injectable } from '@nestjs/common';

@Injectable()
export class TelegramService {
  private token = process.env.TG_BOT_TOKEN || '';
  private chatId = process.env.TG_CHAT_ID || '';

  async send(message: string): Promise<boolean> {
    if (!this.token || !this.chatId) return false;
    try {
      const r = await fetch(`https://api.telegram.org/bot${this.token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: this.chatId, text: message }),
      });
      const body: any = await r.json();
      return body.ok === true;
    } catch {
      return false;
    }
  }
}