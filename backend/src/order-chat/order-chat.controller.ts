import { Body, Controller, Get, HttpCode, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PlatformRole } from '@prisma/client';
import { AccessTokenGuard } from '../auth/access-token.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { RequireRoles } from '../auth/platform-roles';
import { PlatformRolesGuard } from '../auth/platform-roles.guard';
import { CartCsrfGuard } from '../carts/cart-csrf.guard';
import {
  OrderChatListQueryDto,
  OrderChatMessagesQueryDto,
  SendOrderChatMessageDto,
} from './order-chat.dto';
import { OrderChatService } from './order-chat.service';

@ApiTags('order chats')
@ApiBearerAuth()
@Controller('order-chats')
@UseGuards(AccessTokenGuard, PlatformRolesGuard)
@RequireRoles(PlatformRole.BUYER, PlatformRole.SELLER)
export class OrderChatController {
  constructor(private readonly chat: OrderChatService) {}

  @Get()
  list(@CurrentUser() user: { userId: string }, @Query() query: OrderChatListQueryDto) {
    return this.chat.list(user.userId, query);
  }

  @Get('orders/:orderCode')
  detail(@CurrentUser() user: { userId: string }, @Param('orderCode') orderCode: string) {
    return this.chat.detail(user.userId, orderCode);
  }

  @Get('orders/:orderCode/messages')
  messages(
    @CurrentUser() user: { userId: string },
    @Param('orderCode') orderCode: string,
    @Query() query: OrderChatMessagesQueryDto,
  ) {
    return this.chat.messages(user.userId, orderCode, query);
  }

  @Post('orders/:orderCode/messages')
  @HttpCode(200)
  @UseGuards(CartCsrfGuard)
  send(
    @CurrentUser() user: { userId: string },
    @Param('orderCode') orderCode: string,
    @Body() body: SendOrderChatMessageDto,
  ) {
    return this.chat.send(user.userId, orderCode, body);
  }
}
