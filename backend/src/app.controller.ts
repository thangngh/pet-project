import { Controller, Get } from '@nestjs/common';
import { AppService, HealthReport } from './app.service';
import { Public } from './modules/auth/adapters/outbound/auth/public.decorator';
import { SkipGate } from './shared/adapters/feature-gate/skip-gate.decorator';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Public()
  @SkipGate()
  @Get('health')
  getHealth(): Promise<HealthReport> {
    return this.appService.getHealth();
  }
}
