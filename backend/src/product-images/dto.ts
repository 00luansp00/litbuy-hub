import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
export class UploadIntentDto {
  @IsString() contentType!: string;
  @IsInt() @Min(1) sizeBytes!: number;
  @IsOptional() @IsString() @MaxLength(300) altText?: string;
}
export class ReorderImagesDto {
  @IsArray() @ArrayMaxSize(8) @IsUUID('4', { each: true }) imageIds!: string[];
}
