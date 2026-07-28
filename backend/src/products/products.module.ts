import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { ProductImagesModule } from '../product-images/product-images.module';
import { PublicProductCatalogController } from './public-product-catalog.controller';
import { PublicProductCatalogService } from './public-product-catalog.service';
import { ProductMaterializationService } from './product-materialization.service';
import { ProductLifecycleService } from './product-lifecycle.service';
import { ProductLifecycleCsrfGuard } from './product-lifecycle-csrf.guard';
import { AdminProductsController, SellerProductsController } from './products.controller';
@Module({
  imports: [DatabaseModule, AuthModule, JwtModule.register({}), ProductImagesModule],
  controllers: [SellerProductsController, AdminProductsController, PublicProductCatalogController],
  providers: [
    ProductMaterializationService,
    ProductLifecycleService,
    ProductLifecycleCsrfGuard,
    PublicProductCatalogService,
  ],
  exports: [ProductMaterializationService],
})
export class ProductsModule {}
