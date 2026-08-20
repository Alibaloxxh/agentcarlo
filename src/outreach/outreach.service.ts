import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { MailService } from '../mail/mail.service';
import { TelegramService } from '../telegram/telegram.service';

@Injectable()
export class OutreachService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly mail: MailService,
    private readonly telegram: TelegramService,
  ) {}

  async sendPending(): Promise<any[]> {
    const { data, error } = await this.supabase
      .getClient()
      .from('outreach')
      .select('*, leads(score)')
      .eq('status', 'draft')
      .not('to_email', 'is', null);

    if (error) throw new Error(`Supabase query failed: ${error.message}`);
    if (!data || data.length === 0) return [];

    const results = [];
    for (const row of data) {
      const score = row.leads?.score ?? 0;
      if (score < 6) {
        results.push({ id: row.id, to: row.to_email, status: 'skipped-low-score', score });
        continue;
      }
      try {
        await this.mail.send(row.to_email, row.subject, row.body);
        await this.supabase
          .getClient()
          .from('outreach')
          .update({ status: 'sent' })
          .eq('id', row.id);
        results.push({ id: row.id, to: row.to_email, status: 'sent' });
        await this.telegram.send(`✅ Email sent: ${row.subject} -> ${row.to_email}`);
      } catch (err) {
        results.push({ id: row.id, to: row.to_email, status: 'failed', error: (err as Error).message });
        await this.telegram.send(`❌ Email failed: ${row.subject} -> ${row.to_email} (${(err as Error).message})`);
      }
    }
    return results;
  }
}