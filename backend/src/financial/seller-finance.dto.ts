import { Transform } from 'class-transformer';
import { IsEmpty, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class SellerFinanceSummaryQueryDto {
  @IsEmpty()
  sellerProfileId?: string;
}

export class SellerFinanceActivityQueryDto {
  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @Transform(({ value }) => (value === undefined ? 20 : Number(value)))
  @IsInt()
  @Min(1)
  @Max(50)
  limit = 20;
}
