import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiOkResponse, ApiServiceUnavailableResponse, ApiTags } from '@nestjs/swagger';
import { HealthService, type HealthResponse } from './health.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get('live')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ description: 'Application process is running.' })
  live(): HealthResponse {
    return this.healthService.live();
  }

  @Get('ready')
  @ApiOkResponse({ description: 'Application dependencies are available.' })
  @ApiServiceUnavailableResponse({ description: 'At least one dependency is unavailable.' })
  async ready(): Promise<HealthResponse> {
    return this.healthService.ready();
  }
}
