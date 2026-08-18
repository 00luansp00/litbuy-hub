import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthModule } from '../auth/auth.module';
import { CartCsrfGuard } from '../carts/cart-csrf.guard';
import { DatabaseModule } from '../database/database.module';
import { OrderChatController } from './order-chat.controller';
import { OrderChatService } from './order-chat.service';

@Module({
  imports: [DatabaseModule, AuthModule, JwtModule.register({})],
  controllers: [OrderChatController],
  providers: [OrderChatService, CartCsrfGuard],
})
export class OrderChatModule {}
