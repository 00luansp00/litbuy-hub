import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { DatabaseModule } from '../database/database.module';
import { AuthModule } from '../auth/auth.module';
import { ListingDraftsService } from './listing-drafts.service';
import {
  AdminListingDraftsController,
  SellerListingDraftsController,
} from './listing-drafts.controller';
@Module({
  imports: [DatabaseModule, AuthModule, JwtModule.register({})],
  controllers: [SellerListingDraftsController, AdminListingDraftsController],
  providers: [ListingDraftsService],
  exports: [ListingDraftsService],
})
export class ListingDraftsModule {}
