import { Injectable } from '@nestjs/common';
import { TwitterApi } from 'twitter-api-v2';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class XIntegrationService {
  constructor(private readonly supabase: SupabaseService) {}

  async postApproved(): Promise<any[]> {
    const keys = [
      process.env.X_API_KEY,
      process.env.X_API_SECRET,
      process.env.X_ACCESS_TOKEN,
      process.env.X_ACCESS_SECRET,
    ];
    if (keys.some((k) => !k)) {
      throw new Error('X_* env vars not set — fill in .env (Step 7) before posting to X');
    }

    const client = new TwitterApi({
      appKey: process.env.X_API_KEY!,
      appSecret: process.env.X_API_SECRET!,
      accessToken: process.env.X_ACCESS_TOKEN!,
      accessSecret: process.env.X_ACCESS_SECRET!,
    });

    const { data, error } = await this.supabase
      .getClient()
      .from('content_drafts')
      .select('*')
      .eq('status', 'approved');

    if (error) throw new Error(`Supabase query failed: ${error.message}`);
    if (!data || data.length === 0) {
      return [];
    }

    const results: any[] = [];
    for (const row of data) {
      const tweet = await client.v2.tweet(row.content);
      await this.supabase
        .getClient()
        .from('content_drafts')
        .update({ status: 'posted' })
        .eq('id', row.id);
      results.push({ id: row.id, tweetId: tweet.data.id });
    }
    return results;
  }
}