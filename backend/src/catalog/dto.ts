import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { CatalogAttributeInputType, CatalogEntityStatus } from '@prisma/client';
export class CategoryDto {
  @IsString() slug!: string;
  @IsString() name!: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() iconKey?: string;
  @IsOptional() @IsString() colorHex?: string;
  @IsOptional() sortOrder?: number;
  @IsOptional() @IsBoolean() featured?: boolean;
  @IsOptional() @IsEnum(CatalogEntityStatus) status?: CatalogEntityStatus;
}
export class UpdateCategoryDto extends CategoryDto {
  @IsOptional() declare slug: string;
  @IsOptional() declare name: string;
}
export class SubcategoryDto {
  @IsUUID('4') categoryId!: string;
  @IsString() slug!: string;
  @IsString() name!: string;
  @IsOptional() sortOrder?: number;
  @IsOptional() @IsEnum(CatalogEntityStatus) status?: CatalogEntityStatus;
}
export class UpdateSubcategoryDto extends SubcategoryDto {
  @IsOptional() @IsUUID('4') declare categoryId: string;
  @IsOptional() declare slug: string;
  @IsOptional() declare name: string;
}
export class AttributeDto {
  @IsOptional() @IsUUID('4') subcategoryId?: string;
  @IsOptional() @IsString() productType?: string;
  @IsString() key!: string;
  @IsString() label!: string;
  @IsEnum(CatalogAttributeInputType) inputType!: CatalogAttributeInputType;
  @IsOptional() @IsString() @MaxLength(120) placeholder?: string;
  @IsOptional() @IsBoolean() required?: boolean;
  @IsOptional() @IsArray() @IsString({ each: true }) selectOptions?: string[];
  @IsOptional() sortOrder?: number;
  @IsOptional() @IsEnum(CatalogEntityStatus) status?: CatalogEntityStatus;
}
export class UpdateAttributeDto extends AttributeDto {
  @IsOptional() declare key: string;
  @IsOptional() declare label: string;
  @IsOptional() @IsEnum(CatalogAttributeInputType) declare inputType: CatalogAttributeInputType;
}
