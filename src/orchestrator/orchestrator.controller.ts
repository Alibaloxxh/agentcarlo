import { Body, Controller, Post } from '@nestjs/common';
import { ContentAgentService } from '../content-agent/content-agent.service';
import { LeadGenAgentService } from '../leadgen-agent/leadgen-agent.service';
import { XIntegrationService } from '../x-integration/x-integration.service';
import { SourcingService } from '../sourcing/sourcing.service';

@Controller('agent')
export class OrchestratorController {
  constructor(
    private readonly contentAgent: ContentAgentService,
    private readonly leadGenAgent: LeadGenAgentService,
    private readonly xIntegration: XIntegrationService,
    private readonly sourcing: SourcingService,
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
}