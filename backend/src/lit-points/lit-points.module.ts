import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { DatabaseModule } from '../database/database.module';
import { LitPointsController } from './lit-points.controller';
import { LitPointsLedgerService } from './lit-points-ledger.service';

@Module({
  imports: [DatabaseModule, JwtModule.register({})],
  controllers: [LitPointsController],
  providers: [LitPointsLedgerService],
  exports: [LitPointsLedgerService],
})
export class LitPointsModule {}
