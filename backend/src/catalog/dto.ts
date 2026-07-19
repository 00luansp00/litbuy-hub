import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { CatalogEntityStatus } from '@prisma/client';

export class CategoryDto {
  @IsString() slug!: string;
  @IsString() name!: string;
  @IsOptional() @IsString() description?: string | null;
  @IsOptional() @IsString() iconKey?: string | null;
  @IsOptional() @IsString() colorHex?: string | null;
  @IsOptional() sortOrder?: number;
  @IsOptional() @IsBoolean() featured?: boolean;
  @IsOptional() @IsEnum(CatalogEntityStatus) status?: CatalogEntityStatus;
}
export class UpdateCategoryDto {
  @IsOptional() @IsString() slug?: string;
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() description?: string | null;
  @IsOptional() @IsString() iconKey?: string | null;
  @IsOptional() @IsString() colorHex?: string | null;
  @IsOptional() sortOrder?: number;
  @IsOptional() @IsBoolean() featured?: boolean;
  @IsOptional() @IsEnum(CatalogEntityStatus) status?: CatalogEntityStatus;
}
export class SubcategoryDto {
  @IsUUID('4') categoryId!: string;
  @IsString() slug!: string;
  @IsString() name!: string;
  @IsOptional() sortOrder?: number;
  @IsOptional() @IsEnum(CatalogEntityStatus) status?: CatalogEntityStatus;
}
export class UpdateSubcategoryDto {
  @IsOptional() @IsUUID('4') categoryId?: string;
  @IsOptional() @IsString() slug?: string;
  @IsOptional() @IsString() name?: string;
  @IsOptional() sortOrder?: number;
  @IsOptional() @IsEnum(CatalogEntityStatus) status?: CatalogEntityStatus;
}
export class AttributeDto {
  @IsOptional() @IsUUID('4') subcategoryId?: string | null;
  @IsOptional() @IsString() productType?: string | null;
  @IsString() key!: string;
  @IsString() label!: string;
  @IsString() inputType!: string;
  @IsOptional() @IsString() @MaxLength(120) placeholder?: string | null;
  @IsOptional() @IsBoolean() required?: boolean;
  @IsOptional() @IsArray() @IsString({ each: true }) selectOptions?: string[];
  @IsOptional() sortOrder?: number;
  @IsOptional() @IsEnum(CatalogEntityStatus) status?: CatalogEntityStatus;
}
export class UpdateAttributeDto {
  @IsOptional() @IsUUID('4') subcategoryId?: string | null;
  @IsOptional() @IsString() productType?: string | null;
  @IsOptional() @IsString() key?: string;
  @IsOptional() @IsString() label?: string;
  @IsOptional() @IsString() inputType?: string;
  @IsOptional() @IsString() @MaxLength(120) placeholder?: string | null;
  @IsOptional() @IsBoolean() required?: boolean;
  @IsOptional() @IsArray() @IsString({ each: true }) selectOptions?: string[];
  @IsOptional() sortOrder?: number;
  @IsOptional() @IsEnum(CatalogEntityStatus) status?: CatalogEntityStatus;
}
