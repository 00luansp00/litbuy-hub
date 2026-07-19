import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PlatformRole } from '@prisma/client';
import { AccessTokenGuard } from '../auth/access-token.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { PlatformRolesGuard } from '../auth/platform-roles.guard';
import { RequireRoles } from '../auth/platform-roles';
import type { AuthenticatedRequest } from '../auth/auth.types';
import {
  AdminSellerApplicationsQueryDto,
  RejectSellerApplicationDto,
  UpsertSellerApplicationDto,
} from './dto';
import { SellerOnboardingService } from './seller-onboarding.service';

@ApiTags('Seller onboarding')
@Controller()
export class SellerOnboardingController {
  constructor(private readonly service: SellerOnboardingService) {}

  @Get('seller-onboarding/me')
  @UseGuards(AccessTokenGuard)
  @ApiBearerAuth()
  me(@CurrentUser() user: { userId: string }) {
    return this.service.me(user.userId);
  }
  @Put('seller-onboarding/application')
  @UseGuards(AccessTokenGuard)
  @ApiBearerAuth()
  save(@CurrentUser() user: { userId: string }, @Body() dto: UpsertSellerApplicationDto) {
    return this.service.saveDraft(user.userId, dto);
  }
  @Post('seller-onboarding/application/submit')
  @HttpCode(200)
  @UseGuards(AccessTokenGuard)
  @ApiBearerAuth()
  submit(@CurrentUser() user: { userId: string }) {
    return this.service.submit(user.userId);
  }
  @Get('seller-onboarding/slug-availability')
  @UseGuards(AccessTokenGuard)
  @ApiBearerAuth()
  slug(@Query('slug') slug: string) {
    return this.service.slugAvailability(slug ?? '');
  }

  @Get('admin/seller-applications')
  @UseGuards(AccessTokenGuard, PlatformRolesGuard)
  @RequireRoles(PlatformRole.ADMIN)
  @ApiBearerAuth()
  list(@Query() query: AdminSellerApplicationsQueryDto) {
    return this.service.listAdmin(query);
  }
  @Get('admin/seller-applications/:id')
  @UseGuards(AccessTokenGuard, PlatformRolesGuard)
  @RequireRoles(PlatformRole.ADMIN)
  @ApiBearerAuth()
  get(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.service.getAdmin(id);
  }
  @Post('admin/seller-applications/:id/start-review')
  @HttpCode(200)
  @UseGuards(AccessTokenGuard, PlatformRolesGuard)
  @RequireRoles(PlatformRole.ADMIN)
  @ApiBearerAuth()
  start(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.startReview(id, req.auth!.userId);
  }
  @Post('admin/seller-applications/:id/approve')
  @HttpCode(200)
  @UseGuards(AccessTokenGuard, PlatformRolesGuard)
  @RequireRoles(PlatformRole.ADMIN)
  @ApiBearerAuth()
  approve(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.approve(id, req.auth!.userId);
  }
  @Post('admin/seller-applications/:id/reject')
  @HttpCode(200)
  @UseGuards(AccessTokenGuard, PlatformRolesGuard)
  @RequireRoles(PlatformRole.ADMIN)
  @ApiBearerAuth()
  reject(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Req() req: AuthenticatedRequest,
    @Body() dto: RejectSellerApplicationDto,
  ) {
    return this.service.reject(id, req.auth!.userId, dto);
  }
}
