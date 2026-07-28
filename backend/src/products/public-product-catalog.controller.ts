import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PublicCatalogQueryDto, PublicProductSlugDto } from './public-product-catalog.dto';
import { PublicProductCatalogService } from './public-product-catalog.service';

@ApiTags('Public catalog')
@Controller('catalog/products')
export class PublicProductCatalogController {
  constructor(private readonly catalog: PublicProductCatalogService) {}

  @Get()
  list(@Query() query: PublicCatalogQueryDto) {
    return this.catalog.list(query);
  }

  @Get(':slug')
  detail(@Param() { slug }: PublicProductSlugDto) {
    return this.catalog.detail(slug);
  }
}
