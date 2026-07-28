import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import {
  AdminProductImagesController,
  SellerProductImagesController,
} from './product-images.controller';
import { ProductImagesService } from './product-images.service';
import { PRODUCT_IMAGE_STORAGE } from './product-image.storage';
import { S3ProductImageStorage } from './s3-product-image.storage';
@Module({
  imports: [DatabaseModule, AuthModule, JwtModule.register({})],
  controllers: [SellerProductImagesController, AdminProductImagesController],
  providers: [
    ProductImagesService,
    { provide: PRODUCT_IMAGE_STORAGE, useClass: S3ProductImageStorage },
  ],
})
export class ProductImagesModule {}
