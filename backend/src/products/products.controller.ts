import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { PlatformRole } from '@prisma/client';
import { AccessTokenGuard } from '../auth/access-token.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { RequireRoles } from '../auth/platform-roles';
import { PlatformRolesGuard } from '../auth/platform-roles.guard';
import { ProductQueryDto } from './dto';
import { ProductMaterializationService } from './product-materialization.service';
type AuthenticatedUser = { userId: string };

@UseGuards(AccessTokenGuard, PlatformRolesGuard)
@Controller('seller/products')
@RequireRoles(PlatformRole.SELLER)
export class SellerProductsController {
  constructor(private readonly service: ProductMaterializationService) {}
  @Get() list(@CurrentUser() user: AuthenticatedUser, @Query() q: ProductQueryDto) {
    return this.service.listForSeller(user.userId, q);
  }
  @Get(':id') get(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.service.getForSeller(user.userId, id);
  }
}

@UseGuards(AccessTokenGuard, PlatformRolesGuard)
@Controller('admin/products')
@RequireRoles(PlatformRole.ADMIN)
export class AdminProductsController {
  constructor(private readonly service: ProductMaterializationService) {}
  @Get() list(@Query() q: ProductQueryDto) {
    return this.service.adminList(q);
  }
  @Get(':id') get(@Param('id') id: string) {
    return this.service.adminGet(id);
  }
}
