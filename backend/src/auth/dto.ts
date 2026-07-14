import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
export class RegisterDto {
  @ApiProperty() @IsEmail() email!: string;
  @ApiProperty() @IsString() @MinLength(12) @MaxLength(128) password!: string;
  @ApiProperty({ example: '2000-01-31' }) @IsString() birthDate!: string;
  @ApiProperty() @IsBoolean() termsAccepted!: boolean;
  @ApiProperty() @IsBoolean() privacyAccepted!: boolean;
  @ApiProperty() @IsString() termsVersion!: string;
  @ApiProperty() @IsString() privacyVersion!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(80) deviceName?: string;
}
export class EmailDto {
  @ApiProperty() @IsEmail() email!: string;
}
export class TokenDto {
  @ApiProperty() @IsString() @MinLength(20) token!: string;
}
export class LoginDto {
  @ApiProperty() @IsEmail() email!: string;
  @ApiProperty() @IsString() password!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(80) deviceName?: string;
}

export class ResetPasswordDto {
  @ApiProperty() @IsString() @MinLength(20) token!: string;
  @ApiProperty() @IsString() @MinLength(12) @MaxLength(128) newPassword!: string;
}
export class ChangePasswordDto {
  @ApiProperty() @IsString() currentPassword!: string;
  @ApiProperty() @IsString() @MinLength(12) @MaxLength(128) newPassword!: string;
}
