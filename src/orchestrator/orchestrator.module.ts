import { Module } from '@nestjs/common';
import { ContentAgentModule } from '../content-agent/content-agent.module';
import { LeadGenAgentModule } from '../leadgen-agent/leadgen-agent.module';
import { XIntegrationModule } from '../x-integration/x-integration.module';
import { SourcingModule } from '../sourcing/sourcing.module';
import { OrchestratorController } from './orchestrator.controller';

@Module({
  imports: [ContentAgentModule, LeadGenAgentModule, XIntegrationModule, SourcingModule],
  controllers: [OrchestratorController],
})
export class OrchestratorModule {}