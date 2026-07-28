import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { ProductMaterializationService } from './product-materialization.service';
import { ProductLifecycleService } from './product-lifecycle.service';
import { ProductLifecycleCsrfGuard } from './product-lifecycle-csrf.guard';
import { AdminProductsController, SellerProductsController } from './products.controller';
@Module({
  imports: [DatabaseModule, AuthModule, JwtModule.register({})],
  controllers: [SellerProductsController, AdminProductsController],
  providers: [ProductMaterializationService, ProductLifecycleService, ProductLifecycleCsrfGuard],
  exports: [ProductMaterializationService],
})
export class ProductsModule {}
