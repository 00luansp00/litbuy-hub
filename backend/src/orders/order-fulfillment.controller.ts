import { Body, Controller, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PlatformRole } from '@prisma/client';
import { AccessTokenGuard } from '../auth/access-token.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { RequireRoles } from '../auth/platform-roles';
import { PlatformRolesGuard } from '../auth/platform-roles.guard';
import { CartCsrfGuard } from '../carts/cart-csrf.guard';
import { RecordOrderDeliveryDto } from './order-fulfillment.dto';
import { OrderFulfillmentService } from './order-fulfillment.service';
import { OrdersService } from './orders.service';

@ApiTags('order fulfillment')
@ApiBearerAuth()
@Controller('orders/:orderCode/fulfillment')
@UseGuards(AccessTokenGuard, PlatformRolesGuard)
export class OrderFulfillmentController {
  constructor(
    private readonly fulfillment: OrderFulfillmentService,
    private readonly orders: OrdersService,
  ) {}

  @Post('delivered')
  @HttpCode(200)
  @RequireRoles(PlatformRole.SELLER)
  delivered(
    @CurrentUser() actor: { userId: string },
    @Param('orderCode') orderCode: string,
    @Body() dto: RecordOrderDeliveryDto,
  ) {
    return this.fulfillment.recordDelivered({ orderCode, actorUserId: actor.userId, ...dto });
  }

  @Post('confirm')
  @HttpCode(200)
  @RequireRoles(PlatformRole.BUYER)
  @UseGuards(CartCsrfGuard)
  async confirm(@CurrentUser() actor: { userId: string }, @Param('orderCode') orderCode: string) {
    await this.fulfillment.confirmReceipt(orderCode, actor.userId);
    return this.orders.get(actor.userId, orderCode);
  }
}
