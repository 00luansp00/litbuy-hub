import { Body, Controller, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PlatformRole } from '@prisma/client';
import { AccessTokenGuard } from '../auth/access-token.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { RequireRoles } from '../auth/platform-roles';
import { PlatformRolesGuard } from '../auth/platform-roles.guard';
import { RecordOrderDeliveryDto } from './order-fulfillment.dto';
import { OrderFulfillmentService } from './order-fulfillment.service';

@ApiTags('order fulfillment')
@ApiBearerAuth()
@Controller('orders/:orderCode/fulfillment')
@UseGuards(AccessTokenGuard, PlatformRolesGuard)
export class OrderFulfillmentController {
  constructor(private readonly fulfillment: OrderFulfillmentService) {}

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
  confirm(@CurrentUser() actor: { userId: string }, @Param('orderCode') orderCode: string) {
    return this.fulfillment.confirmReceipt(orderCode, actor.userId);
  }
}
