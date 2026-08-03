import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';
import type { Request } from 'express';
import { ProviderNotificationIngressService } from './provider-notification-ingress.service';

class EfiBillingNotificationDto {
  @IsString()
  @MinLength(8)
  @MaxLength(256)
  @Matches(/^[A-Za-z0-9_-]+$/)
  notification!: string;
}

@Controller('webhooks/efi')
export class ProviderNotificationController {
  constructor(private readonly ingress: ProviderNotificationIngressService) {}

  @Post('billing')
  @HttpCode(HttpStatus.NO_CONTENT)
  async efiBilling(
    @Req() request: Request,
    @Body() body: EfiBillingNotificationDto,
  ): Promise<void> {
    if (!request.is('application/x-www-form-urlencoded'))
      throw new UnsupportedMediaTypeException({ code: 'UNSUPPORTED_CONTENT_TYPE' });
    await this.ingress.acceptEfiBilling(body.notification);
  }
}
