import { Module } from '@nestjs/common';
import { MailService } from './mail.service';
import { GmailApiService } from './gmail-api.service';

@Module({
  providers: [MailService, GmailApiService],
  exports: [MailService, GmailApiService],
})
export class MailModule {}