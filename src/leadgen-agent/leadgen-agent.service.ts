import { Injectable } from '@nestjs/common';
import { GroqService, extractJson } from '../common/groq.service';
import { SupabaseService } from '../supabase/supabase.service';
import { LEAD_PROMPT } from '../common/prompts';

@Injectable()
export class LeadGenAgentService {
  constructor(
    private readonly groq: GroqService,
    private readonly supabase: SupabaseService,
  ) {}

  async evaluate(source: string, text: string): Promise<any> {
    if (!text) {
      throw new Error('text is required');
    }
    const raw = await this.groq.complete(
      LEAD_PROMPT,
      `Source: ${source || 'manual'}\nLead text: ${text}`,
    );
    const parsed = extractJson(raw);

    const { data, error } = await this.supabase
      .getClient()
      .from('leads')
      .insert({
        source: source || 'manual',
        raw_text: text,
        project_name: parsed.project_name ?? null,
        what_they_need: parsed.what_they_need ?? null,
        score: parsed.score ?? null,
        legitimacy: parsed.legitimacy ?? null,
        budget_signal: parsed.budget_signal ?? null,
        fit: parsed.fit ?? null,
        red_flags: parsed.red_flags ?? null,
        contact_path: parsed.contact_path ?? null,
        pitch_angle: parsed.pitch_angle ?? null,
        confidence: parsed.confidence ?? null,
      })
      .select()
      .single();

    if (error) throw new Error(`Supabase insert failed: ${error.message}`);
    return data;
  }
}