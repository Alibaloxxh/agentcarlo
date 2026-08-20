import { Module } from '@nestjs/common';
import { SupabaseModule } from '../supabase/supabase.module';
import { MailModule } from '../mail/mail.module';
import { OutreachService } from './outreach.service';

@Module({
  imports: [SupabaseModule, MailModule],
  providers: [OutreachService],
  exports: [OutreachService],
})
export class OutreachModule {}