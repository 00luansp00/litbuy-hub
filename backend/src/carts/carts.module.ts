import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { CartCsrfGuard } from './cart-csrf.guard';
import { CartsController } from './carts.controller';
import { CartsService } from './carts.service';
@Module({
  imports: [DatabaseModule, AuthModule, JwtModule.register({})],
  controllers: [CartsController],
  providers: [CartsService, CartCsrfGuard],
  exports: [CartsService],
})
export class CartsModule {}
