import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

const integerQuery = ({ value }: { value: unknown }) =>
  typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value;

export class CartListQueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Transform(integerQuery)
  @IsInt()
  @Min(1)
  page = 1;
  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 50 })
  @IsOptional()
  @Transform(integerQuery)
  @IsInt()
  @Min(1)
  @Max(50)
  limit = 20;
}
export class AddCartItemDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID('4') productId!: string;
  @ApiPropertyOptional({ format: 'uuid' }) @IsOptional() @IsUUID('4') productVariantId?: string;
  @ApiProperty({ minimum: 1, maximum: 999 }) @IsInt() @Min(1) @Max(999) quantity!: number;
  @ApiProperty({ minimum: 0 }) @IsInt() @Min(0) expectedVersion!: number;
}
export class UpdateCartItemDto {
  @ApiProperty({ minimum: 1, maximum: 999 }) @IsInt() @Min(1) @Max(999) quantity!: number;
  @ApiProperty({ minimum: 0 }) @IsInt() @Min(0) expectedVersion!: number;
}
export class RemoveCartItemDto {
  @ApiProperty({ minimum: 0 }) @IsInt() @Min(0) expectedVersion!: number;
}
