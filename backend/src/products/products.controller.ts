import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { PlatformRole } from '@prisma/client';
import { AccessTokenGuard } from '../auth/access-token.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { RequireRoles } from '../auth/platform-roles';
import { PlatformRolesGuard } from '../auth/platform-roles.guard';
import { ProductLifecycleDto, ProductQueryDto } from './dto';
import { SellerMaxRestockDto } from './dto';
import { parseIdempotencyKey } from '../commerce/idempotency-key';
import { ProductLifecycleService } from './product-lifecycle.service';
import { ProductLifecycleCsrfGuard } from './product-lifecycle-csrf.guard';
import { ProductMaterializationService } from './product-materialization.service';
import { SellerMaxInventoryService } from './seller-max-inventory.service';
type AuthenticatedUser = { userId: string };

@UseGuards(AccessTokenGuard, PlatformRolesGuard)
@Controller('seller/products')
@RequireRoles(PlatformRole.SELLER)
export class SellerProductsController {
  constructor(
    private readonly service: ProductMaterializationService,
    private readonly lifecycle: ProductLifecycleService,
    private readonly inventory: SellerMaxInventoryService,
  ) {}
  @Get() list(@CurrentUser() user: AuthenticatedUser, @Query() q: ProductQueryDto) {
    return this.service.listForSeller(user.userId, q);
  }
  @Get(':id') get(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.service.getForSeller(user.userId, id);
  }
  @Patch(':id/lifecycle')
  @UseGuards(ProductLifecycleCsrfGuard)
  transition(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: ProductLifecycleDto,
  ) {
    return this.lifecycle.transition(user.userId, id, dto);
  }
  @Post(':id/inventory/restock')
  @UseGuards(ProductLifecycleCsrfGuard)
  restock(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Headers('idempotency-key') key: unknown,
    @Body() dto: SellerMaxRestockDto,
  ) {
    return this.inventory.restock(user.userId, id, parseIdempotencyKey(key), dto);
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
