import {
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiTags } from '@nestjs/swagger';
import { PlatformRole } from '@prisma/client';
import { AccessTokenGuard } from '../auth/access-token.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { PlatformRolesGuard } from '../auth/platform-roles.guard';
import { RequireRoles } from '../auth/platform-roles';
import { CartCsrfGuard } from '../carts/cart-csrf.guard';
import { parseIdempotencyKey } from '../commerce/idempotency-key';
import { BuyerPaymentService } from './buyer-payment.service';
@ApiTags('buyer-payments')
@ApiBearerAuth()
@Controller('orders')
@UseGuards(AccessTokenGuard, PlatformRolesGuard)
@RequireRoles(PlatformRole.BUYER)
export class BuyerPaymentController {
  constructor(private readonly payments: BuyerPaymentService) {}
  @Get(':orderCode/payment') read(
    @CurrentUser() u: { userId: string },
    @Param('orderCode') c: string,
  ) {
    return this.payments.read(u.userId, c);
  }
  @Post(':orderCode/payment-attempts')
  @HttpCode(201)
  @UseGuards(CartCsrfGuard)
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  initiate(
    @CurrentUser() u: { userId: string },
    @Param('orderCode') c: string,
    @Headers('idempotency-key') k: unknown,
  ) {
    return this.payments.initiate(u.userId, c, parseIdempotencyKey(k));
  }
  @Post(':orderCode/payment-attempts/:attemptId/alpha-confirm')
  @HttpCode(200)
  @UseGuards(CartCsrfGuard)
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  confirm(
    @CurrentUser() u: { userId: string },
    @Param('orderCode') c: string,
    @Param('attemptId', new ParseUUIDPipe()) a: string,
    @Headers('idempotency-key') k: unknown,
  ) {
    return this.payments.confirm(u.userId, c, a, parseIdempotencyKey(k));
  }
}
