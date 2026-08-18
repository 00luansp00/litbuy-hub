import { Transform } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

const integer = ({ value }: { value: unknown }) =>
  typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value;

export class OrderChatListQueryDto {
  @IsOptional() @Transform(integer) @IsInt() @Min(1) page = 1;
  @IsOptional() @Transform(integer) @IsInt() @Min(1) @Max(50) limit = 20;
}

export class OrderChatMessagesQueryDto {
  @IsOptional() @IsUUID() cursor?: string;
  @IsOptional() @Transform(integer) @IsInt() @Min(1) @Max(50) limit = 20;
}

export class SendOrderChatMessageDto {
  @IsUUID() clientMessageId!: string;
  @IsString() @IsNotEmpty() @MaxLength(4000) text!: string;
}
