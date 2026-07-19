import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import {
  SELLER_PUBLIC_STATUSES,
  SELLER_REJECTION_CODES,
  type SellerPublicStatus,
  type SellerRejectionCode,
} from './seller-onboarding.utils';

export class UpsertSellerApplicationDto {
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(80) storeName!: string;
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(80) requestedSlug!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(600) description?: string;
  @ApiProperty() @IsBoolean() sellerAgreementAccepted!: boolean;
}

export class AdminSellerApplicationsQueryDto {
  @ApiPropertyOptional({ enum: SELLER_PUBLIC_STATUSES })
  @IsOptional()
  @IsIn(SELLER_PUBLIC_STATUSES)
  status?: SellerPublicStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(80)
  search?: string;

  @ApiPropertyOptional({ minimum: 1, maximum: 50 })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => (value === undefined ? undefined : Number(value)))
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID('4')
  cursor?: string;
}

export class RejectSellerApplicationDto {
  @ApiProperty({ enum: SELLER_REJECTION_CODES })
  @IsIn(SELLER_REJECTION_CODES)
  code!: SellerRejectionCode;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) reason?: string;
}
