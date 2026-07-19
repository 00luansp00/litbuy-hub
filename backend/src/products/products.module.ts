import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { ProductMaterializationService } from './product-materialization.service';
import { AdminProductsController, SellerProductsController } from './products.controller';
@Module({
  imports: [DatabaseModule, AuthModule, JwtModule.register({})],
  controllers: [SellerProductsController, AdminProductsController],
  providers: [ProductMaterializationService],
  exports: [ProductMaterializationService],
})
export class ProductsModule {}
