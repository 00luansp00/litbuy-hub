import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PlatformRole } from '@prisma/client';
import { AccessTokenGuard } from '../auth/access-token.guard';
import { PlatformRolesGuard } from '../auth/platform-roles.guard';
import { RequireRoles } from '../auth/platform-roles';
import type { AuthenticatedRequest } from '../auth/auth.types';
import { CatalogService } from './catalog.service';
import {
  AttributeDto,
  CategoryDto,
  SubcategoryDto,
  UpdateAttributeDto,
  UpdateCategoryDto,
  UpdateSubcategoryDto,
} from './dto';
@ApiTags('Catalog')
@Controller()
export class CatalogController {
  constructor(private readonly service: CatalogService) {}
  @Get('catalog/categories') categories() {
    return this.service.publicCategories();
  }
  @Get('catalog/categories/:slug') category(@Param('slug') slug: string) {
    return this.service.publicCategoryBySlug(slug);
  }
  @Get('catalog/categories/:categorySlug/subcategories') subcategories(
    @Param('categorySlug') categorySlug: string,
  ) {
    return this.service.publicSubcategories(categorySlug);
  }
  @Get('catalog/product-types') productTypes() {
    return this.service.productTypes();
  }
  @Get('catalog/attributes') attributes(
    @Query() q: { categorySlug?: string; subcategorySlug?: string; productType?: string },
  ) {
    return this.service.attributes(q);
  }
  @Get('admin/catalog/categories')
  @UseGuards(AccessTokenGuard, PlatformRolesGuard)
  @RequireRoles(PlatformRole.ADMIN)
  @ApiBearerAuth()
  adminCategories() {
    return this.service.adminCategories();
  }
  @Post('admin/catalog/categories')
  @UseGuards(AccessTokenGuard, PlatformRolesGuard)
  @RequireRoles(PlatformRole.ADMIN)
  @ApiBearerAuth()
  createCategory(@Body() dto: CategoryDto, @Req() req: AuthenticatedRequest) {
    return this.service.createCategory(dto, req.auth!.userId);
  }
  @Patch('admin/catalog/categories/:id')
  @UseGuards(AccessTokenGuard, PlatformRolesGuard)
  @RequireRoles(PlatformRole.ADMIN)
  @ApiBearerAuth()
  updateCategory(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateCategoryDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.updateCategory(id, dto, req.auth!.userId);
  }
  @Get('admin/catalog/subcategories')
  @UseGuards(AccessTokenGuard, PlatformRolesGuard)
  @RequireRoles(PlatformRole.ADMIN)
  @ApiBearerAuth()
  adminSubcategories() {
    return this.service.adminSubcategories();
  }
  @Post('admin/catalog/subcategories')
  @UseGuards(AccessTokenGuard, PlatformRolesGuard)
  @RequireRoles(PlatformRole.ADMIN)
  @ApiBearerAuth()
  createSubcategory(@Body() dto: SubcategoryDto, @Req() req: AuthenticatedRequest) {
    return this.service.createSubcategory(dto, req.auth!.userId);
  }
  @Patch('admin/catalog/subcategories/:id')
  @UseGuards(AccessTokenGuard, PlatformRolesGuard)
  @RequireRoles(PlatformRole.ADMIN)
  @ApiBearerAuth()
  updateSubcategory(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateSubcategoryDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.updateSubcategory(id, dto, req.auth!.userId);
  }
  @Get('admin/catalog/attributes')
  @UseGuards(AccessTokenGuard, PlatformRolesGuard)
  @RequireRoles(PlatformRole.ADMIN)
  @ApiBearerAuth()
  adminAttributes() {
    return this.service.adminAttributes();
  }
  @Post('admin/catalog/attributes')
  @UseGuards(AccessTokenGuard, PlatformRolesGuard)
  @RequireRoles(PlatformRole.ADMIN)
  @ApiBearerAuth()
  createAttribute(@Body() dto: AttributeDto, @Req() req: AuthenticatedRequest) {
    return this.service.createAttribute(dto, req.auth!.userId);
  }
  @Patch('admin/catalog/attributes/:id')
  @UseGuards(AccessTokenGuard, PlatformRolesGuard)
  @RequireRoles(PlatformRole.ADMIN)
  @ApiBearerAuth()
  updateAttribute(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateAttributeDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.updateAttribute(id, dto, req.auth!.userId);
  }
}
