import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { LeadGenAgentService } from '../leadgen-agent/leadgen-agent.service';
import { GroqService, extractJson } from '../common/groq.service';
import { OUTREACH_PROMPT } from '../common/prompts';

const SOURCE_URL = 'https://jobs.solana.com/jobs';
const STACK_KEYWORDS = [
  'react native',
  'nestjs',
  'fastapi',
  'supabase',
  'full-stack',
  'fullstack',
  'mobile',
  'react',
  'node',
  'typescript',
  'solana',
  'web3',
];

@Injectable()
export class SourcingService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly leadgen: LeadGenAgentService,
    private readonly groq: GroqService,
  ) {}

  async scan(): Promise<any> {
    const html = await fetch(SOURCE_URL).then((r) => r.text());
    const jobs = this.extractJobs(html);
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
      const parsed = await this.leadgen.scoreRaw('jobs.solana.com', text);

      const { data: lead, error: leadErr } = await this.supabase
        .getClient()
        .from('leads')
        .insert({
          source: 'jobs.solana.com',
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

      const outRaw = await this.groq.complete(
        OUTREACH_PROMPT,
        `Job: ${job.title}\nCompany: ${job.company}\nDetails: ${text}\nFit notes from evaluation: ${parsed.fit ?? 'n/a'}`,
      );
      const out = extractJson(outRaw);

      await this.supabase
        .getClient()
        .from('outreach')
        .insert({ lead_id: lead.id, subject: out.subject ?? '', body: out.body ?? '' });

      await this.supabase
        .getClient()
        .from('scanned_jobs')
        .insert({ job_url: job.url });

      results.push({ lead_id: lead.id, project: lead.project_name, score: lead.score, subject: out.subject });
    }

    return { scanned: jobs.length, matched: matches.length, processed: results.length, results };
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
    return `Job: ${job.title} at ${job.company}. Mode: ${job.workMode}. Locations: ${job.locations}. Apply: ${job.url}`;
  }
}