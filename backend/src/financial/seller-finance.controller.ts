import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AccessTokenGuard } from '../auth/access-token.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { SellerFinanceActivityQueryDto } from './seller-finance.dto';
import { SellerFinanceReadService } from './seller-finance-read.service';

@ApiTags('Seller finance')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard)
@Controller({ path: 'seller/finance', version: '1' })
export class SellerFinanceController {
  constructor(private readonly service: SellerFinanceReadService) {}
  @Get('summary') summary(@CurrentUser() user: { userId: string }) {
    return this.service.summary(user.userId);
  }
  @Get('activity') activity(
    @CurrentUser() user: { userId: string },
    @Query() query: SellerFinanceActivityQueryDto,
  ) {
    return this.service.activity(user.userId, query);
  }
}
