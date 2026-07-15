import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  IsUUID,
  IsIn,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
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
export class PhoneRequestDto {
  @ApiProperty() @IsString() phone!: string;
  @ApiProperty() @IsString() currentPassword!: string;
}
export class PhoneVerifyDto {
  @ApiProperty() @IsUUID('4') challengeId!: string;
  @ApiProperty() @IsString() @Matches(/^[0-9]{6}$/) code!: string;
  @ApiProperty() @IsString() phone!: string;
}
export class EmailChangeRequestDto {
  @ApiProperty() @IsEmail() newEmail!: string;
  @ApiProperty() @IsString() currentPassword!: string;
}
export class EmailChangeConfirmDto {
  @ApiProperty() @IsString() @MinLength(20) token!: string;
  @ApiProperty() @IsEmail() newEmail!: string;
}

export class TwoFactorEnrollRequestDto {
  @ApiProperty({ enum: ['EMAIL', 'SMS'] }) @IsIn(['EMAIL', 'SMS']) method!: 'EMAIL' | 'SMS';
  @ApiProperty() @IsString() currentPassword!: string;
}
export class TwoFactorCodeDto {
  @ApiProperty() @IsUUID('4') challengeId!: string;
  @ApiProperty() @IsString() @Matches(/^[0-9]{6}$/) code!: string;
}
export class TwoFactorLoginVerifyDto {
  @ApiProperty() @IsUUID('4') challengeId!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @Matches(/^[0-9]{6}$/) code?: string;
  @ApiPropertyOptional({ example: 'ABCDE-12345-FGHIJ' })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsString()
  @Matches(/^[A-Z0-9]{5}-[A-Z0-9]{5}-[A-Z0-9]{5}$/)
  recoveryCode?: string;
}
export class TwoFactorChallengeDto {
  @ApiProperty() @IsUUID('4') challengeId!: string;
}
export class TwoFactorDisableRequestDto {
  @ApiProperty() @IsString() currentPassword!: string;
}

export class StepUpRequestDto {
  @ApiProperty({ enum: ['TWO_FACTOR_METHOD_CHANGE', 'TWO_FACTOR_RECOVERY_REGENERATE'] })
  @IsIn(['TWO_FACTOR_METHOD_CHANGE', 'TWO_FACTOR_RECOVERY_REGENERATE'])
  scope!: 'TWO_FACTOR_METHOD_CHANGE' | 'TWO_FACTOR_RECOVERY_REGENERATE';
  @ApiProperty() @IsString() currentPassword!: string;
}
export class StepUpVerifyDto {
  @ApiProperty() @IsUUID('4') challengeId!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @Matches(/^[0-9]{6}$/) code?: string;
  @ApiPropertyOptional({ example: 'ABCDE-12345-FGHIJ' })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsString()
  @Matches(/^[A-Z0-9]{5}-[A-Z0-9]{5}-[A-Z0-9]{5}$/)
  recoveryCode?: string;
}
export class StepUpResendDto {
  @ApiProperty() @IsUUID('4') challengeId!: string;
}
export class TwoFactorMethodChangeRequestDto {
  @ApiProperty({ enum: ['EMAIL', 'SMS'] }) @IsIn(['EMAIL', 'SMS']) newMethod!: 'EMAIL' | 'SMS';
}
export class TwoFactorMethodChangeConfirmDto {
  @ApiProperty() @IsUUID('4') challengeId!: string;
  @ApiProperty() @IsString() @Matches(/^[0-9]{6}$/) code!: string;
}
