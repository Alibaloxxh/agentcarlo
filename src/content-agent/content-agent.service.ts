import { Injectable } from '@nestjs/common';
import { GroqService, extractJson } from '../common/groq.service';
import { SupabaseService } from '../supabase/supabase.service';
import { CONTENT_PROMPT } from '../common/prompts';

@Injectable()
export class ContentAgentService {
  constructor(
    private readonly groq: GroqService,
    private readonly supabase: SupabaseService,
  ) {}

  async draft(topic: string): Promise<any> {
    if (!topic) {
      throw new Error('topic is required');
    }
    const raw = await this.groq.complete(CONTENT_PROMPT, `Topic: ${topic}`);
    const parsed = extractJson(raw);

    const { data, error } = await this.supabase
      .getClient()
      .from('content_drafts')
      .insert({
        topic,
        content: parsed.content,
        status: 'draft',
        format: parsed.format ?? null,
        context: parsed.context ?? null,
        confidence: parsed.confidence ?? null,
      })
      .select()
      .single();

    if (error) throw new Error(`Supabase insert failed: ${error.message}`);
    return data;
  }
}