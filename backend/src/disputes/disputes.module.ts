import { Module } from '@nestjs/common';
import { DisputeCoreService } from './dispute-core.service';

@Module({ providers: [DisputeCoreService], exports: [DisputeCoreService] })
export class DisputesModule {}
