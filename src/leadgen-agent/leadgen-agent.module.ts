import { Module } from '@nestjs/common';
import { CommonModule } from '../common/common.module';
import { SupabaseModule } from '../supabase/supabase.module';
import { LeadGenAgentService } from './leadgen-agent.service';

@Module({
  imports: [CommonModule, SupabaseModule],
  providers: [LeadGenAgentService],
  exports: [LeadGenAgentService],
})
export class LeadGenAgentModule {}