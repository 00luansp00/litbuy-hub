import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Matches, Max, Min } from 'class-validator';
import { CatalogProductType } from '@prisma/client';

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export enum PublicCatalogSort {
  RECENT = 'RECENT',
  OLDEST = 'OLDEST',
  TITLE_ASC = 'TITLE_ASC',
  TITLE_DESC = 'TITLE_DESC',
}

export class PublicCatalogQueryDto {
  @IsOptional() @Matches(SLUG) categorySlug?: string;
  @IsOptional() @Matches(SLUG) subcategorySlug?: string;
  @IsOptional() @IsEnum(CatalogProductType) productType?: CatalogProductType;
  @IsOptional() @IsEnum(PublicCatalogSort) sort: PublicCatalogSort = PublicCatalogSort.RECENT;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50) limit = 24;
}

export class PublicProductSlugDto {
  @Matches(SLUG) slug!: string;
}
