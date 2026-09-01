import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiTags } from '@nestjs/swagger';
import { PlatformRole } from '@prisma/client';
import { AccessTokenGuard } from '../auth/access-token.guard';
import { PlatformRolesGuard } from '../auth/platform-roles.guard';
import { RequireRoles } from '../auth/platform-roles';
import { CurrentUser } from '../auth/current-user.decorator';
import { CartCsrfGuard } from '../carts/cart-csrf.guard';
import { parseIdempotencyKey } from '../commerce/idempotency-key';
import { OrdersService } from './orders.service';
import { CancelOrderDto, OrderListQueryDto } from './orders.dto';
@ApiTags('orders')
@ApiBearerAuth()
@Controller('orders')
@UseGuards(AccessTokenGuard, PlatformRolesGuard)
@RequireRoles(PlatformRole.BUYER)
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}
  @Get() list(@CurrentUser() u: { userId: string }, @Query() q: OrderListQueryDto) {
    return this.orders.list(u.userId, q);
  }
  @Get(':orderCode') get(@CurrentUser() u: { userId: string }, @Param('orderCode') c: string) {
    return this.orders.get(u.userId, c);
  }
  @Post(':orderCode/cancel')
  @HttpCode(200)
  @UseGuards(CartCsrfGuard)
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  cancel(
    @CurrentUser() u: { userId: string },
    @Param('orderCode') c: string,
    @Headers('idempotency-key') k: unknown,
    @Body() d: CancelOrderDto,
  ) {
    return this.orders.cancel(u.userId, c, parseIdempotencyKey(k), d);
  }
  @Post(':orderCode/report-problem')
  @HttpCode(200)
  @UseGuards(CartCsrfGuard)
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  reportProblem(
    @CurrentUser() u: { userId: string },
    @Param('orderCode') c: string,
    @Headers('idempotency-key') k: unknown,
  ) {
    return this.orders.reportProblem(u.userId, c, parseIdempotencyKey(k));
  }
}
