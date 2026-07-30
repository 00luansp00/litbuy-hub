import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PlatformRole } from '@prisma/client';
import { AccessTokenGuard } from '../auth/access-token.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { RequireRoles } from '../auth/platform-roles';
import { PlatformRolesGuard } from '../auth/platform-roles.guard';
import { CartCsrfGuard } from './cart-csrf.guard';
import {
  AddCartItemDto,
  CartListQueryDto,
  RemoveCartItemDto,
  UpdateCartItemDto,
} from './carts.dto';
import { CartsService } from './carts.service';
type User = { userId: string };
@ApiTags('carts')
@ApiBearerAuth()
@Controller('carts')
@UseGuards(AccessTokenGuard, PlatformRolesGuard)
@RequireRoles(PlatformRole.BUYER)
export class CartsController {
  constructor(private readonly carts: CartsService) {}
  @Get() list(@CurrentUser() user: User, @Query() query: CartListQueryDto) {
    return this.carts.list(user.userId, query);
  }
  @Get(':sellerSlug') get(@CurrentUser() user: User, @Param('sellerSlug') slug: string) {
    return this.carts.get(user.userId, slug);
  }
  @Post(':sellerSlug/items') @UseGuards(CartCsrfGuard) add(
    @CurrentUser() user: User,
    @Param('sellerSlug') slug: string,
    @Body() dto: AddCartItemDto,
  ) {
    return this.carts.add(user.userId, slug, dto);
  }
  @Patch(':sellerSlug/items/:itemId') @UseGuards(CartCsrfGuard) update(
    @CurrentUser() user: User,
    @Param('sellerSlug') slug: string,
    @Param('itemId', new ParseUUIDPipe({ version: '4' })) itemId: string,
    @Body() dto: UpdateCartItemDto,
  ) {
    return this.carts.update(user.userId, slug, itemId, dto);
  }
  @Delete(':sellerSlug/items/:itemId') @UseGuards(CartCsrfGuard) remove(
    @CurrentUser() user: User,
    @Param('sellerSlug') slug: string,
    @Param('itemId', new ParseUUIDPipe({ version: '4' })) itemId: string,
    @Body() dto: RemoveCartItemDto,
  ) {
    return this.carts.remove(user.userId, slug, itemId, dto);
  }
}
