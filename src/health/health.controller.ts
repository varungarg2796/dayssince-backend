// src/health/health.controller.ts
import { Controller, Get } from '@nestjs/common';

@Controller('health') // Base path: /api/health
export class HealthController {
  @Get()
  checkHealth() {
    return {
      status: 'ok-api',
      timestamp: new Date().toISOString(),
    };
  }
}
