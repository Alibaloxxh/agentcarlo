import { Body, Controller, Get, Post } from '@nestjs/common';
import { ContentAgentService } from '../content-agent/content-agent.service';
import { LeadGenAgentService } from '../leadgen-agent/leadgen-agent.service';
import { XIntegrationService } from '../x-integration/x-integration.service';
import { SourcingService } from '../sourcing/sourcing.service';
import { OutreachService } from '../outreach/outreach.service';
import { MailService } from '../mail/mail.service';
import { TelegramService } from '../telegram/telegram.service';
import { SerperSearchService } from '../sourcing/serper-search.service';

@Controller('agent')
export class OrchestratorController {
  constructor(
    private readonly contentAgent: ContentAgentService,
    private readonly leadGenAgent: LeadGenAgentService,
    private readonly xIntegration: XIntegrationService,
    private readonly sourcing: SourcingService,
    private readonly outreach: OutreachService,
    private readonly mail: MailService,
    private readonly telegram: TelegramService,
    private readonly serper: SerperSearchService,
  ) {}

  @Post('draft')
  async draft(@Body('topic') topic: string) {
    return this.contentAgent.draft(topic);
  }

  @Post('evaluate-lead')
  async evaluateLead(@Body('source') source: string, @Body('text') text: string) {
    return this.leadGenAgent.evaluate(source, text);
  }

  @Post('post-approved')
  async postApproved() {
    return this.xIntegration.postApproved();
  }

  @Post('scan-leads')
  async scanLeads() {
    return this.sourcing.scan();
  }

  @Post('send-outreach')
  async sendOutreach() {
    return this.outreach.sendPending();
  }

  @Post('hunt')
  async hunt(@Body() body: { companies: Array<{ project: string; domain: string; note?: string }> }) {
    return this.sourcing.hunt(body.companies ?? []);
  }

  @Post('hunt-search')
  async huntSearch() {
    return this.serper.run();
  }

  @Get('hunt-quota')
  async huntQuota() {
    return this.serper.quotaStatus();
  }

  @Get('smtp-test')
  async smtpTest() {
    return this.mail.diagnose();
  }

  @Get('tg-test')
  async tgTest() {
    return { ok: await this.telegram.send('🔔 Test from AgentCarlo bot — notifications working!') };
  }
}