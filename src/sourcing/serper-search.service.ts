import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { SourcingService } from './sourcing.service';
import { TelegramService } from '../telegram/telegram.service';

const SEARCH_TERMS = [
  'solo founder looking for developer web3',
  'need technical cofounder solana',
  'early stage startup hiring react native developer',
  'seeking full stack developer nestjs crypto startup',
  'web3 startup need mobile app developer',
  'founder looking for developer website app launch',
];

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)';
const QUOTA_LIMIT = 2500;

@Injectable()
export class SerperSearchService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly sourcing: SourcingService,
    private readonly telegram: TelegramService,
  ) {}

  async quotaStatus(): Promise<any> {
    const { count } = await this.supabase
      .getClient()
      .from('agent_runs')
      .select('*', { count: 'exact', head: true })
      .eq('agent', 'serper_query');
    const used = count ?? 0;
    return { used, limit: QUOTA_LIMIT, remaining: QUOTA_LIMIT - used };
  }

  async run(): Promise<any> {
    const key = process.env.SERPER_API_KEY;
    if (!key) throw new Error('SERPER_API_KEY not set');

    const { used, remaining } = await this.quotaStatus();
    if (remaining <= 0) {
      await this.telegram.send('⚠️ Serper search quota exhausted — founder-hunt search stopped.');
      return { quotaUsed: used, quotaLimit: QUOTA_LIMIT, searched: 0 };
    }

    const candidates: Array<{ project: string; domain: string; note: string }> = [];
    let searched = 0;
    for (const term of SEARCH_TERMS) {
      const status = await this.quotaStatus();
      if (status.remaining <= 0) break;
      try {
        const res = await fetch('https://google.serper.dev/search', {
          method: 'POST',
          headers: { 'X-API-KEY': key, 'Content-Type': 'application/json', 'User-Agent': USER_AGENT },
          body: JSON.stringify({ q: term, gl: 'us', hl: 'en', num: 10 }),
        });
        searched += 1;
        await this.supabase
          .getClient()
          .from('agent_runs')
          .insert({ agent: 'serper_query', input: term, output: `http ${res.status}` });
        const body: any = await res.json();
        const items = body.organic ?? [];
        for (const item of items.slice(0, 3)) {
          const title = item.title ?? '';
          const link = item.link ?? '';
          const snippet = item.snippet ?? '';
          if (!title || !link) continue;
          const domain = this.extractDomain(link);
          if (!domain) continue;
          const hasBuyIntent = /(looking for|hiring|need.*developer|seeking|technical cofounder|co-founder)/i.test(`${title} ${snippet}`);
          const isJobBoard = /(linkedin\.com\/jobs|indeed\.com|remoteok|weworkremotely|glassdoor)/i.test(link);
          if (isJobBoard || !hasBuyIntent) continue;
          candidates.push({ project: title.split('|')[0].trim(), domain, note: snippet.slice(0, 300) });
        }
      } catch {
        // skip failed term
      }
    }

    const { used: afterUsed } = await this.quotaStatus();
    await this.telegram.send(`🔎 Founder-hunt search: ${searched} queries, ${candidates.length} candidates, quota ${afterUsed}/${QUOTA_LIMIT}`);
    if (candidates.length === 0) return { quotaUsed: afterUsed, quotaLimit: QUOTA_LIMIT, searched, processed: 0 };

    const results = await this.sourcing.hunt(candidates.slice(0, 5));
    return { quotaUsed: afterUsed, quotaLimit: QUOTA_LIMIT, searched, candidates, processed: results.length, results };
  }

  private extractDomain(link: string): string | null {
    try {
      const u = new URL(link);
      return u.hostname.replace(/^www\./, '');
    } catch {
      return null;
    }
  }
}