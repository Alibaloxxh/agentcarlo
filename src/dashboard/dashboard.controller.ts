import { Controller, Get, Res, Query, UnauthorizedException } from '@nestjs/common';
import { Response } from 'express';
import { readFileSync } from 'fs';
import { join } from 'path';
import { SupabaseService } from '../supabase/supabase.service';

@Controller()
export class DashboardController {
  private readonly html = readFileSync(join(__dirname, '..', '..', 'public', 'dashboard.html'), 'utf-8');

  constructor(private readonly supabase: SupabaseService) {}

  @Get('dashboard')
  async dashboard(@Res() res: Response) {
    res.type('text/html').send(this.html);
  }

  @Get('api/dashboard')
  async data(@Query('key') key: string) {
    const expected = process.env.DASHBOARD_KEY || '';
    if (expected && key !== expected) throw new UnauthorizedException('bad key');
    const [leads, outreach, scanned] = await Promise.all([
      this.supabase.getClient().from('leads').select('*').order('created_at', { ascending: false }).limit(50),
      this.supabase.getClient().from('outreach').select('*, leads(project_name,score)').order('created_at', { ascending: false }).limit(50),
      this.supabase.getClient().from('scanned_jobs').select('count').limit(1),
    ]);
    if (leads.error) throw new Error(`leads: ${leads.error.message}`);
    if (outreach.error) throw new Error(`outreach: ${outreach.error.message}`);
    const sent = outreach.data?.filter((o) => o.status === 'sent').length ?? 0;
    return {
      leads: leads.data,
      outreach: outreach.data,
      stats: {
        totalLeads: leads.data?.length ?? 0,
        sentEmails: sent,
        totalScans: scanned.data?.[0]?.count ?? 0,
      },
    };
  }
}