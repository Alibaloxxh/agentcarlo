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

@Injectable()
export class SourcingService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly leadgen: LeadGenAgentService,
    private readonly groq: GroqService,
    private readonly telegram: TelegramService,
  ) {}

  async scan(): Promise<any> {
    const jobs = await this.fetchAllJobs();
    const matches = jobs.filter((j) => this.matchesStack(j));

    const results = [];
    for (const job of matches) {
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
        })
        .select()
        .single();
      if (leadErr) throw new Error(`Lead insert failed: ${leadErr.message}`);

      let toEmail: string | null = null;
      const isBoard = job.source === 'jobs.solana.com';
      const isWorthNotifying = (parsed.score ?? 0) >= 6;
      if (isBoard) {
        const outRaw = await this.groq.complete(
          OUTREACH_PROMPT,
          `Job: ${job.title}\nCompany: ${job.company}\nDetails: ${text}\nFit notes from evaluation: ${parsed.fit ?? 'n/a'}`,
        );
        const out = extractJson(outRaw);

        toEmail = await this.resolveCompanyEmail(job.url);

        await this.supabase
          .getClient()
          .from('outreach')
          .insert({
            lead_id: lead.id,
            subject: out.subject ?? '',
            body: out.body ?? '',
            to_email: toEmail ?? null,
          });
      }

      await this.supabase
        .getClient()
        .from('scanned_jobs')
        .insert({ job_url: job.url });

      results.push({ lead_id: lead.id, project: lead.project_name, score: lead.score, subject: isBoard ? 'drafted' : 'bid-on-platform', to_email: toEmail ?? null, source: job.source });

      if (isWorthNotifying) {
        await this.telegram.send(
          `🆕 New lead: ${lead.project_name} (score ${lead.score}/10)\nWhat: ${parsed.what_they_need ?? job.title}\nContact: ${toEmail ?? job.url}\nSource: ${job.source}`,
        );
      }
    }

    return { scanned: jobs.length, matched: matches.length, processed: results.length, results };
  }

  private async fetchAllJobs(): Promise<any[]> {
    const [boardJobs, freelanceJobs] = await Promise.all([
      this.fetchBoardJobs().catch(() => []),
      this.fetchFreelanceJobs().catch(() => []),
    ]);
    return [...boardJobs, ...freelanceJobs];
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
    const haystack = `${job.title} ${job.company}`.toLowerCase();
    return STACK_KEYWORDS.some((k) => haystack.includes(k));
  }

  private describe(job: any): string {
    const base = `Job: ${job.title} at ${job.company}. Mode: ${job.workMode}. Locations: ${job.locations}. Apply: ${job.url}`;
    const extra = job.description ? `\nDescription: ${job.description}` : '';
    const budget = job.budget ? `\nBudget: ${job.budget}` : '';
    return `${base}${extra}${budget}`;
  }
}