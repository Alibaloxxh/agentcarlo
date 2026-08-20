import { Module } from '@nestjs/common';
import { ContentAgentModule } from '../content-agent/content-agent.module';
import { LeadGenAgentModule } from '../leadgen-agent/leadgen-agent.module';
import { XIntegrationModule } from '../x-integration/x-integration.module';
import { SourcingModule } from '../sourcing/sourcing.module';
import { OutreachModule } from '../outreach/outreach.module';
import { MailModule } from '../mail/mail.module';
import { TelegramModule } from '../telegram/telegram.module';
import { OrchestratorController } from './orchestrator.controller';

@Module({
  imports: [ContentAgentModule, LeadGenAgentModule, XIntegrationModule, SourcingModule, OutreachModule, MailModule, TelegramModule],
  controllers: [OrchestratorController],
})
export class OrchestratorModule {}