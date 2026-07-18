import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { SELLER_REJECTION_CODES, type SellerRejectionCode } from './seller-onboarding.utils';

export class UpsertSellerApplicationDto {
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(80) storeName!: string;
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(80) requestedSlug!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(600) description?: string;
  @ApiProperty() @IsBoolean() sellerAgreementAccepted!: boolean;
}
export class RejectSellerApplicationDto {
  @ApiProperty({ enum: SELLER_REJECTION_CODES })
  @IsIn(SELLER_REJECTION_CODES)
  code!: SellerRejectionCode;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) reason?: string;
}
