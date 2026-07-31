import { Body, Controller, Headers, HttpCode, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiTags } from '@nestjs/swagger';
import { PlatformRole } from '@prisma/client';
import { AccessTokenGuard } from '../auth/access-token.guard';
import { PlatformRolesGuard } from '../auth/platform-roles.guard';
import { RequireRoles } from '../auth/platform-roles';
import { CurrentUser } from '../auth/current-user.decorator';
import { CartCsrfGuard } from '../carts/cart-csrf.guard';
import { parseIdempotencyKey } from '../commerce/idempotency-key';
import { CheckoutService } from './checkout.service';
import { CreateCheckoutDto } from './checkout.dto';
@ApiTags('checkout')
@ApiBearerAuth()
@Controller('checkout-sessions')
@UseGuards(AccessTokenGuard, PlatformRolesGuard)
@RequireRoles(PlatformRole.BUYER)
export class CheckoutController {
  constructor(private readonly checkout: CheckoutService) {}
  @Post()
  @HttpCode(201)
  @UseGuards(CartCsrfGuard)
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  create(
    @CurrentUser() user: { userId: string },
    @Headers('idempotency-key') key: unknown,
    @Body() dto: CreateCheckoutDto,
  ) {
    return this.checkout.create(user.userId, parseIdempotencyKey(key), dto);
  }
}
