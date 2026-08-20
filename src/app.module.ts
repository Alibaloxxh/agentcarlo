import { Module } from '@nestjs/common';
import { OrchestratorModule } from './orchestrator/orchestrator.module';
import { DashboardModule } from './dashboard/dashboard.module';

@Module({
  imports: [OrchestratorModule, DashboardModule],
})
export class AppModule {}