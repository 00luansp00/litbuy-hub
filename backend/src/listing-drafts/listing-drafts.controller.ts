import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { PlatformRole } from '@prisma/client';
import { AccessTokenGuard } from '../auth/access-token.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { RequireRoles } from '../auth/platform-roles';
import { PlatformRolesGuard } from '../auth/platform-roles.guard';
type AuthenticatedUser = { userId: string; sessionId: string; deviceId: string };
import {
  AdminDraftQueryDto,
  CreateDraftDto,
  RejectDraftDto,
  SellerDraftQueryDto,
  UpdateDraftDto,
  VersionDto,
} from './dto';
import { ListingDraftsService } from './listing-drafts.service';

@UseGuards(AccessTokenGuard, PlatformRolesGuard)
@Controller({ path: 'seller/listing-drafts', version: '1' })
@RequireRoles(PlatformRole.SELLER)
export class SellerListingDraftsController {
  constructor(private readonly service: ListingDraftsService) {}
  @Get() list(@CurrentUser() user: AuthenticatedUser, @Query() q: SellerDraftQueryDto) {
    return this.service.list(user.userId, q);
  }
  @Post() create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateDraftDto) {
    return this.service.create(user.userId, dto);
  }
  @Get(':id') get(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.service.get(user.userId, id);
  }
  @Patch(':id') update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateDraftDto,
  ) {
    return this.service.update(user.userId, id, dto);
  }
  @Post(':id/submit') submit(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: VersionDto,
  ) {
    return this.service.submit(user.userId, id, dto);
  }
}

@UseGuards(AccessTokenGuard, PlatformRolesGuard)
@Controller({ path: 'admin/listing-drafts', version: '1' })
@RequireRoles(PlatformRole.ADMIN)
export class AdminListingDraftsController {
  constructor(private readonly service: ListingDraftsService) {}
  @Get() list(@Query() q: AdminDraftQueryDto) {
    return this.service.adminList(q);
  }
  @Get(':id') get(@Param('id') id: string) {
    return this.service.adminGet(id);
  }
  @Post(':id/start-review') start(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: VersionDto,
  ) {
    return this.service.startReview(user.userId, id, dto);
  }
  @Post(':id/reject') reject(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: RejectDraftDto,
  ) {
    return this.service.reject(user.userId, id, dto);
  }
  @Post(':id/approve') approve(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: VersionDto,
  ) {
    return this.service.approve(user.userId, id, dto);
  }
}
