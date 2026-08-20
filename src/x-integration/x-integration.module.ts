import { Module } from '@nestjs/common';
import { SupabaseModule } from '../supabase/supabase.module';
import { XIntegrationService } from './x-integration.service';

@Module({
  imports: [SupabaseModule],
  providers: [XIntegrationService],
  exports: [XIntegrationService],
})
export class XIntegrationModule {}