import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  ListingDraftAccountProvenance,
  ListingDraftAccountRecoveryLevel,
  ListingDraftAccountRecoveryRisk,
  ListingDraftDeliveryMode,
  ListingDraftModel,
  ListingDraftPromotionPreference,
  ListingDraftSellerPlanPreference,
  ListingDraftServicePricingType,
  ListingDraftStatus,
  ListingDraftVariantStatus,
} from '@prisma/client';

export class AttributeValueDto {
  @IsString() key!: string;
  @IsString() value!: string;
}
export class VariantDto {
  @IsOptional() @IsString() id?: string;
  @IsString() title!: string;
  @IsOptional() @IsString() description?: string | null;
  @IsString() price!: string;
  @IsInt() @Min(0) stock!: number;
  @IsOptional() @IsEnum(ListingDraftVariantStatus) status?: ListingDraftVariantStatus;
  @IsOptional() @IsInt() sortOrder?: number;
}
export class ServiceDetailsDto {
  @IsOptional() @IsString() title?: string | null;
  @IsOptional() @IsString() description?: string | null;
  @IsOptional()
  @IsEnum(ListingDraftServicePricingType)
  pricingType?: ListingDraftServicePricingType | null;
  @IsOptional() @IsString() basePrice?: string | null;
  @IsOptional() @IsString() estimatedDelivery?: string | null;
  @IsOptional() @IsString() buyerRequirements?: string | null;
  @IsOptional() @IsString() notes?: string | null;
}
export class AccountDetailsDto {
  @IsOptional()
  @IsEnum(ListingDraftAccountProvenance)
  provenance?: ListingDraftAccountProvenance | null;
  @IsOptional()
  @IsEnum(ListingDraftAccountRecoveryLevel)
  recoveryLevel?: ListingDraftAccountRecoveryLevel | null;
  @IsOptional() @IsBoolean() emailVerified?: boolean | null;
  @IsOptional() @IsBoolean() phoneLinked?: boolean | null;
  @IsOptional() @IsBoolean() documentLinked?: boolean | null;
  @IsOptional() @IsBoolean() fullAccess?: boolean | null;
  @IsOptional()
  @IsEnum(ListingDraftAccountRecoveryRisk)
  recoveryRisk?: ListingDraftAccountRecoveryRisk | null;
  @IsOptional() @IsString() warrantyNote?: string | null;
}
export class DraftPatchDto {
  @IsOptional() @IsEnum(ListingDraftModel) model?: ListingDraftModel;
  @IsOptional() @IsUUID('4') categoryId?: string | null;
  @IsOptional() @IsUUID('4') subcategoryId?: string | null;
  @IsOptional() @IsString() productType?: string | null;
  @IsOptional() @IsString() title?: string | null;
  @IsOptional() @IsString() description?: string | null;
  @IsOptional() @IsString() price?: string | null;
  @IsOptional() @IsInt() @Min(0) stock?: number | null;
  @IsOptional() @IsEnum(ListingDraftDeliveryMode) deliveryMode?: ListingDraftDeliveryMode;
  @IsOptional()
  @IsEnum(ListingDraftPromotionPreference)
  requestedPromotionTier?: ListingDraftPromotionPreference;
  @IsOptional()
  @IsEnum(ListingDraftSellerPlanPreference)
  requestedSellerPlan?: ListingDraftSellerPlanPreference;
  @IsOptional() @IsString() autoMessage?: string | null;
  @IsOptional() @IsBoolean() notifyInApp?: boolean;
  @IsOptional() @IsBoolean() notifyBrowser?: boolean;
  @IsOptional() @IsBoolean() notifyEmailFuture?: boolean;
  @IsOptional() @IsBoolean() notifyExternalFuture?: boolean;
  @IsOptional() @IsInt() @Min(1) @Max(6) wizardStep?: number;
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AttributeValueDto)
  attributes?: AttributeValueDto[];
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VariantDto)
  variants?: VariantDto[];
  @IsOptional()
  @ValidateNested()
  @Type(() => ServiceDetailsDto)
  serviceDetails?: ServiceDetailsDto | null;
  @IsOptional()
  @ValidateNested()
  @Type(() => AccountDetailsDto)
  accountDetails?: AccountDetailsDto | null;
}
export class CreateDraftDto extends DraftPatchDto {}
export class VersionDto {
  @IsInt() @Min(1) expectedVersion!: number;
}
export class UpdateDraftDto extends DraftPatchDto {
  @IsInt() @Min(1) expectedVersion!: number;
}
export class SellerDraftQueryDto {
  @IsOptional() @IsEnum(ListingDraftStatus) status?: ListingDraftStatus;
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsInt() @Min(1) @Max(50) limit?: number;
  @IsOptional() @IsString() cursor?: string;
}
export class AdminDraftQueryDto extends SellerDraftQueryDto {
  @IsOptional() @IsString() seller?: string;
  @IsOptional() @IsUUID('4') categoryId?: string;
}
export class RejectDraftDto extends VersionDto {
  @IsString() rejectionCode!: string;
  @IsString() rejectionReason!: string;
}
