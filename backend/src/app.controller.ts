import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { Public } from './modules/auth/adapters/outbound/auth/public.decorator';
import { SkipGate } from './shared/adapters/feature-gate/skip-gate.decorator';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Public()
  @SkipGate()
  @Get('health')
  getHealth(): { status: string; timestamp: string } {
    return this.appService.getHealth();
  }
}
