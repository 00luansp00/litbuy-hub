import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AccessTokenGuard } from '../auth/access-token.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { LitPointsHistoryQueryDto } from './lit-points.dto';
import { LitPointsLedgerService } from './lit-points-ledger.service';

@ApiTags('LIT Points')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard)
@Controller('lit-points/me')
export class LitPointsController {
  constructor(private readonly ledger: LitPointsLedgerService) {}

  @Get()
  balance(@CurrentUser() user: { userId: string }) {
    return this.ledger.balance(user.userId);
  }

  @Get('history')
  history(@CurrentUser() user: { userId: string }, @Query() query: LitPointsHistoryQueryDto) {
    return this.ledger.history(user.userId, query.limit, query.cursor);
  }
}
