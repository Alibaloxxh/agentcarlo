import { Module } from '@nestjs/common';
import { CommonModule } from '../common/common.module';
import { SupabaseModule } from '../supabase/supabase.module';
import { ContentAgentService } from './content-agent.service';

@Module({
  imports: [CommonModule, SupabaseModule],
  providers: [ContentAgentService],
  exports: [ContentAgentService],
})
export class ContentAgentModule {}