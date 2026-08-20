import { Module } from '@nestjs/common';
import { SupabaseModule } from '../supabase/supabase.module';
import { CommonModule } from '../common/common.module';
import { LeadGenAgentModule } from '../leadgen-agent/leadgen-agent.module';
import { TelegramModule } from '../telegram/telegram.module';
import { SourcingService } from './sourcing.service';

@Module({
  imports: [SupabaseModule, CommonModule, LeadGenAgentModule, TelegramModule],
  providers: [SourcingService],
  exports: [SourcingService],
})
export class SourcingModule {}