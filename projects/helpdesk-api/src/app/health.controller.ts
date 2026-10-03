import { Controller, Get } from '@nestjs/common';

/** What the health check answers while the API is up. */
export interface HealthStatus {
  status: 'ok';
}

/**
 * GET /api/health: answers as soon as the API is running, so Docker Compose
 * (and anything else watching the API) can tell when it is ready.
 */
@Controller('health')
export class HealthController {
  @Get()
  check(): HealthStatus {
    return { status: 'ok' };
  }
}
