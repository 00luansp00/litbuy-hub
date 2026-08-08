import { ApiProperty } from '@nestjs/swagger';
import { OrderDeliveryType } from '@prisma/client';
import { IsEnum, Matches } from 'class-validator';

export class RecordOrderDeliveryDto {
  @ApiProperty({ enum: OrderDeliveryType })
  @IsEnum(OrderDeliveryType)
  deliveryType!: OrderDeliveryType;

  @ApiProperty({
    description: 'Lowercase or uppercase SHA-256 hex digest; never delivery content.',
  })
  @Matches(/^[a-fA-F0-9]{64}$/)
  evidenceHash!: string;
}
