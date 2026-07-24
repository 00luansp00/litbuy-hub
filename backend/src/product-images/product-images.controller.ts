import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { PlatformRole } from '@prisma/client';
import { AccessTokenGuard } from '../auth/access-token.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { PlatformRolesGuard } from '../auth/platform-roles.guard';
import { RequireRoles } from '../auth/platform-roles';
import { ReorderImagesDto, UploadIntentDto } from './dto';
import { ProductImagesService } from './product-images.service';
type User = { userId: string };

@UseGuards(AccessTokenGuard, PlatformRolesGuard)
@RequireRoles(PlatformRole.SELLER)
@Controller('seller/products/:productId/images')
export class SellerProductImagesController {
  constructor(private readonly service: ProductImagesService) {}
  @Post('upload-intents') intent(
    @CurrentUser() user: User,
    @Param('productId') productId: string,
    @Body() body: UploadIntentDto,
  ) {
    return this.service.createIntent(user.userId, productId, body);
  }
  @Post(':imageId/complete') complete(
    @CurrentUser() user: User,
    @Param('productId') productId: string,
    @Param('imageId') imageId: string,
  ) {
    return this.service.complete(user.userId, productId, imageId);
  }
  @Get() list(@CurrentUser() user: User, @Param('productId') productId: string) {
    return this.service.listSeller(user.userId, productId);
  }
  @Patch('reorder') reorder(
    @CurrentUser() user: User,
    @Param('productId') productId: string,
    @Body() body: ReorderImagesDto,
  ) {
    return this.service.reorder(user.userId, productId, body.imageIds);
  }
  @Patch(':imageId/cover') cover(
    @CurrentUser() user: User,
    @Param('productId') productId: string,
    @Param('imageId') imageId: string,
  ) {
    return this.service.cover(user.userId, productId, imageId);
  }
  @Delete(':imageId') remove(
    @CurrentUser() user: User,
    @Param('productId') productId: string,
    @Param('imageId') imageId: string,
  ) {
    return this.service.remove(user.userId, productId, imageId);
  }
}

@UseGuards(AccessTokenGuard, PlatformRolesGuard)
@RequireRoles(PlatformRole.ADMIN)
@Controller('admin/products/:productId/images')
export class AdminProductImagesController {
  constructor(private readonly service: ProductImagesService) {}
  @Get() list(@Param('productId') productId: string) {
    return this.service.listAdmin(productId);
  }
}
