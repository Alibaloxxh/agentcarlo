import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { LeadGenAgentService } from '../leadgen-agent/leadgen-agent.service';
import { GroqService, extractJson } from '../common/groq.service';
import { OUTREACH_PROMPT } from '../common/prompts';
import { TelegramService } from '../telegram/telegram.service';

const SOURCE_URL = 'https://jobs.solana.com/jobs';
const STACK_KEYWORDS = [
  'react native',
  'nestjs',
  'fastapi',
  'supabase',
  'full-stack',
  'fullstack',
  'mobile',
  'backend',
  'react',
  'node',
  'typescript',
  'solana',
  'web3',
  'website',
  'web app',
  'frontend',
  'front-end',
  'ios',
  'android',
  'flutter',
  'landing page',
  'ecommerce',
  'e-commerce',
];
const FREELANCE_URL = 'https://www.freelancer.com/api/projects/0.1/projects/active/';
const FREELANCE_QUERY = 'website OR app OR mobile OR web development OR react';
const FREELANCE_COUNTRIES = ['US', 'GB', 'CA', 'AU', 'DE', 'FR', 'NL', 'AE', 'SG'];
const REMOTEOK_URL = 'https://remoteok.com/api';
const WWR_URL = 'https://weworkremotely.com/categories/remote-programming-jobs.rss';

@Injectable()
export class SourcingService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly leadgen: LeadGenAgentService,
    private readonly groq: GroqService,
    private readonly telegram: TelegramService,
  ) {}

  async hunt(companies: Array<{ project: string; domain: string; note?: string }>): Promise<any> {
    const results = [];
    for (const c of companies) {
      await this.pace();
      const email = await this.resolveDomainEmail(c.domain);
      const text = `Company: ${c.project}\nWebsite: https://${c.domain}\nContact email found: ${email ?? 'none published'}\nContext: ${c.note ?? 'Early-stage company needing web or mobile development.'}`;
      const parsed = await this.leadgen.scoreRaw('web-search', text);

      const { data: lead, error: leadErr } = await this.supabase
        .getClient()
        .from('leads')
        .insert({
          source: 'web-search',
          raw_text: text,
          project_name: parsed.project_name ?? c.project,
          what_they_need: parsed.what_they_need ?? null,
          score: parsed.score ?? null,
          legitimacy: parsed.legitimacy ?? null,
          budget_signal: parsed.budget_signal ?? null,
          fit: parsed.fit ?? null,
          red_flags: parsed.red_flags ?? null,
          contact_path: `https://${c.domain}`,
          pitch_angle: parsed.pitch_angle ?? null,
          confidence: parsed.confidence ?? null,
          buyer_type: parsed.buyer_type ?? null,
        })
        .select()
        .single();
      if (leadErr) throw new Error(`Lead insert failed: ${leadErr.message}`);

      if (email && parsed.confidence === 'high') {
        const outRaw = await this.groq.complete(
          OUTREACH_PROMPT,
          `Company: ${c.project}\nDetails: ${text}\nFit notes from evaluation: ${parsed.fit ?? 'n/a'}`,
        );
        const out = extractJson(outRaw);
        await this.supabase
          .getClient()
          .from('outreach')
          .insert({
            lead_id: lead.id,
            subject: out.subject ?? '',
            body: out.body ?? '',
            to_email: email,
          });
      }

      const isWorthNotifying = (parsed.score ?? 0) >= 6;
      const isHighConfidence = parsed.confidence === 'high';
      if (isWorthNotifying) {
        await this.telegram.send(
          `🆕 Founder lead: ${lead.project_name} (score ${lead.score}/10)\nWhat: ${parsed.what_they_need ?? 'web/mobile development'}\nEmail: ${email ?? 'not published'}\nSite: https://${c.domain}\nConfidence: ${parsed.confidence ?? 'n/a'} | Type: ${parsed.buyer_type ?? 'unknown'}${isHighConfidence ? '' : '\n⚠️ REVIEW — not auto-sent (low/medium confidence)'}`,
        );
      }

      results.push({ lead_id: lead.id, project: lead.project_name, score: lead.score, email, domain: c.domain });
    }
    return results;
  }

  async scan(): Promise<any> {
    const jobs = await this.fetchAllJobs();
    const matches = jobs.filter((j) => this.matchesStack(j)).slice(0, 8);

    const results = [];
    for (const job of matches) {
      await this.pace();
      const dup = await this.supabase
        .getClient()
        .from('scanned_jobs')
        .select('id')
        .eq('job_url', job.url)
        .maybeSingle();
      if (dup.data) continue;

      const text = this.describe(job);
      const parsed = await this.leadgen.scoreRaw(job.source, text);

      const { data: lead, error: leadErr } = await this.supabase
        .getClient()
        .from('leads')
        .insert({
          source: job.source,
          raw_text: text,
          project_name: parsed.project_name ?? job.company,
          what_they_need: parsed.what_they_need ?? job.title,
          score: parsed.score ?? null,
          legitimacy: parsed.legitimacy ?? null,
          budget_signal: parsed.budget_signal ?? null,
          fit: parsed.fit ?? null,
          red_flags: parsed.red_flags ?? null,
          contact_path: job.url,
          pitch_angle: parsed.pitch_angle ?? null,
          confidence: parsed.confidence ?? null,
          buyer_type: parsed.buyer_type ?? null,
        })
        .select()
        .single();
      if (leadErr) throw new Error(`Lead insert failed: ${leadErr.message}`);

      let toEmail: string | null = null;
      const isBoard = job.source === 'jobs.solana.com';
      const isHighConfidence = parsed.confidence === 'high';
      const isWorthNotifying = (parsed.score ?? 0) >= 6;
      if (isBoard && isHighConfidence) {
        const outRaw = await this.groq.complete(
          OUTREACH_PROMPT,
          `Job: ${job.title}\nCompany: ${job.company}\nDetails: ${text}\nFit notes from evaluation: ${parsed.fit ?? 'n/a'}`,
        );
        const out = extractJson(outRaw);

        toEmail = await this.resolveCompanyEmail(job.url);

        if (toEmail) {
          await this.supabase
            .getClient()
            .from('outreach')
            .insert({
              lead_id: lead.id,
              subject: out.subject ?? '',
              body: out.body ?? '',
              to_email: toEmail,
            });
        }
      }

      await this.supabase
        .getClient()
        .from('scanned_jobs')
        .insert({ job_url: job.url });

      results.push({ lead_id: lead.id, project: lead.project_name, score: lead.score, subject: isBoard && isHighConfidence ? 'drafted' : 'review', to_email: toEmail ?? null, source: job.source, confidence: parsed.confidence ?? null, buyer_type: parsed.buyer_type ?? null });

      if (isWorthNotifying) {
        await this.telegram.send(
          `🆕 New lead: ${lead.project_name} (score ${lead.score}/10)\nWhat: ${parsed.what_they_need ?? job.title}\nContact: ${toEmail ?? job.url}\nSource: ${job.source}\nConfidence: ${parsed.confidence ?? 'n/a'} | Type: ${parsed.buyer_type ?? 'unknown'}${isHighConfidence ? '' : '\n⚠️ REVIEW — not auto-sent (low/medium confidence)'}`,
        );
      }
    }

    return { scanned: jobs.length, matched: matches.length, processed: results.length, results };
  }

  private async pace(): Promise<void> {
    await new Promise((r) => setTimeout(r, 13000));
  }

  private async fetchAllJobs(): Promise<any[]> {
    const [boardJobs, freelanceJobs, remoteokJobs, wwrJobs] = await Promise.all([
      this.fetchBoardJobs().catch(() => []),
      this.fetchFreelanceJobs().catch(() => []),
      this.fetchRemoteOkJobs().catch(() => []),
      this.fetchWwrJobs().catch(() => []),
    ]);
    return [...boardJobs, ...freelanceJobs, ...remoteokJobs, ...wwrJobs];
  }

  private async fetchRemoteOkJobs(): Promise<any[]> {
    const res = await fetch(REMOTEOK_URL, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const body: any = await res.json();
    if (!Array.isArray(body)) return [];
    return body
      .filter((j: any) => j && typeof j === 'object' && j.position)
      .map((j: any) => ({
        id: j.id ?? j.slug ?? j.position,
        title: j.position ?? '',
        company: j.company ?? 'Unknown',
        url: j.url ?? '',
        workMode: 'remote',
        locations: (j.location ?? 'remote').split(',').map((s: string) => s.trim()).join(', '),
        description: (j.description ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 800),
        source: 'remoteok.com',
      }));
  }

  private async fetchWwrJobs(): Promise<any[]> {
    const text = await fetch(WWR_URL, { headers: { 'User-Agent': 'Mozilla/5.0' } }).then((r) => r.text());
    const items = [...text.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((m) => m[1]);
    return items.map((raw, i) => {
      const tag = (name: string) => raw.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`))?.[1]?.trim() ?? '';
      const title = tag('title');
      const link = tag('link');
      const desc = tag('description').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      return {
        id: `wwr-${i}-${title}`,
        title,
        company: title.split(':')[0]?.trim() ?? 'Unknown',
        url: link,
        workMode: 'remote',
        locations: 'remote',
        description: desc.slice(0, 800),
        source: 'weworkremotely.com',
      };
    });
  }

  private async fetchBoardJobs(): Promise<any[]> {
    const html = await fetch(SOURCE_URL).then((r) => r.text());
    const jobs = this.extractJobs(html);
    return jobs.map((j) => ({ ...j, source: 'jobs.solana.com' }));
  }

  private async fetchFreelanceJobs(): Promise<any[]> {
    const params = new URLSearchParams({
      query: FREELANCE_QUERY,
      limit: '50',
      'compact': 'true',
    });
    for (const c of FREELANCE_COUNTRIES) params.append('countries[]', c);
    const url = `${FREELANCE_URL}?${params.toString()}`;
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const body: any = await res.json();
    if (body.status !== 'success' || !body.result?.projects) return [];
    return body.result.projects
      .filter((p: any) => p.status === 'active')
      .map((p: any) => ({
        id: p.id,
        title: p.title ?? '',
        company: 'Freelancer.com client',
        url: p.seo_url ? `https://www.freelancer.com/projects/${p.seo_url}` : `https://www.freelancer.com/projects/${p.id}`,
        workMode: 'freelance',
        locations: p.currency?.country ?? 'US/UK/international',
        description: p.preview_description ?? '',
        budget: p.budget ? `${p.budget.minimum}-${p.budget.maximum} ${p.currency?.code ?? ''}` : '',
        source: 'freelancer.com',
      }));
  }

  private async resolveDomainEmail(domain: string): Promise<string | null> {
    const pages = [`https://${domain}`, `https://${domain}/contact`, `https://${domain}/contact-us`, `https://${domain}/about`];
    for (const url of pages) {
      try {
        const html = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(10000) }).then((r) => r.text());
        const matches = html.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) ?? [];
        const clean = matches.filter((e) => !e.includes('.png') && !e.includes('.jpg') && !e.includes('.webp'));
        const prefer = clean.find((e) => /hello|info|contact|team|founder|support|sales|careers/i.test(e)) ?? clean[0];
        if (prefer) return prefer;
      } catch {
        // try next page
      }
    }
    return null;
  }

  private async resolveCompanyEmail(jobUrl: string): Promise<string | null> {
    try {
      const html = await fetch(jobUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } }).then((r) => r.text());
      const matches = html.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) ?? [];
      const prefer = matches.find((e) => /careers?|jobs|hiring|hello|info|contact|team|recruit/i.test(e));
      return prefer ?? matches[0] ?? null;
    } catch {
      return null;
    }
  }

  private extractJobs(html: string): any[] {
    const start = html.indexOf('"jobs":{"found":[');
    if (start === -1) return [];
    const open = html.indexOf('[', start);
    let depth = 0;
    for (let i = open; i < html.length; i++) {
      if (html[i] === '[') depth++;
      else if (html[i] === ']') {
        depth--;
        if (depth === 0) {
          const arr = JSON.parse(html.slice(open, i + 1));
          return arr.map((j: any) => ({
            id: j.id,
            title: j.title,
            company: j.organization?.name ?? 'Unknown',
            url: j.url ?? '',
            workMode: j.workMode ?? '',
            locations: (j.locations ?? []).join(', '),
          }));
        }
      }
    }
    return [];
  }

  private matchesStack(job: any): boolean {
    const title = `${job.title} ${job.company}`.toLowerCase();
    const inTitle = STACK_KEYWORDS.some((k) => title.includes(k));
    if (job.source === 'jobs.solana.com') {
      const desc = `${job.title} ${job.company} ${job.description ?? ''}`.toLowerCase();
      return STACK_KEYWORDS.some((k) => desc.includes(k));
    }
    if (job.source === 'freelancer.com') {
      const desc = `${job.title} ${job.description ?? ''}`.toLowerCase();
      return STACK_KEYWORDS.some((k) => desc.includes(k));
    }
    return inTitle;
  }

  private describe(job: any): string {
    const base = `Job: ${job.title} at ${job.company}. Mode: ${job.workMode}. Locations: ${job.locations}. Apply: ${job.url}`;
    const extra = job.description ? `\nDescription: ${job.description}` : '';
    const budget = job.budget ? `\nBudget: ${job.budget}` : '';
    return `${base}${extra}${budget}`;
  }
}