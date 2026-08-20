import { Module } from '@nestjs/common';
import { SupabaseModule } from '../supabase/supabase.module';
import { DashboardController } from './dashboard.controller';

@Module({
  imports: [SupabaseModule],
  controllers: [DashboardController],
})
export class DashboardModule {}