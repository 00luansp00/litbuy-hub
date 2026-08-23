import { ApiProperty } from '@nestjs/swagger';
import { BuyerVipPlan } from '@prisma/client';
import { IsDefined, IsEnum, IsInt, IsString, Matches, Min } from 'class-validator';
export class CreateCheckoutDto {
  @ApiProperty() @IsString() @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/) sellerSlug!: string;
  @ApiProperty({ minimum: 1 }) @IsInt() @Min(1) expectedCartVersion!: number;
  @ApiProperty() @IsString() @Matches(/^sha256:[a-f0-9]{64}$/) expectedPreviewFingerprint!: string;
  @ApiProperty({ enum: BuyerVipPlan })
  @IsDefined()
  @IsEnum(BuyerVipPlan)
  buyerVipPlan!: string;
}
