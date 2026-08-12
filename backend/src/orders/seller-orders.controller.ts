import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PlatformRole } from '@prisma/client';
import { AccessTokenGuard } from '../auth/access-token.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { RequireRoles } from '../auth/platform-roles';
import { PlatformRolesGuard } from '../auth/platform-roles.guard';
import { OrderListQueryDto } from './orders.dto';
import { SellerOrdersService } from './seller-orders.service';

@ApiTags('seller orders')
@ApiBearerAuth()
@Controller('seller/orders')
@UseGuards(AccessTokenGuard, PlatformRolesGuard)
@RequireRoles(PlatformRole.SELLER)
export class SellerOrdersController {
  constructor(private readonly orders: SellerOrdersService) {}
  @Get() list(@CurrentUser() user: { userId: string }, @Query() query: OrderListQueryDto) {
    return this.orders.list(user.userId, query);
  }
  @Get(':orderCode') get(
    @CurrentUser() user: { userId: string },
    @Param('orderCode') orderCode: string,
  ) {
    return this.orders.get(user.userId, orderCode);
  }
}
