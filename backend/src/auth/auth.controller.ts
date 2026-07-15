import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiCookieAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import {
  ChangePasswordDto,
  EmailChangeConfirmDto,
  EmailChangeRequestDto,
  PhoneRequestDto,
  PhoneVerifyDto,
  EmailDto,
  LoginDto,
  RegisterDto,
  ResetPasswordDto,
  TokenDto,
} from './dto';
import { AccessTokenGuard } from './access-token.guard';
import { CurrentUser } from './current-user.decorator';
@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}
  @Post('register')
  @ApiOperation({
    summary: 'Cadastro com e-mail, senha Argon2id, dispositivo inicial e desafio de confirmação',
  })
  register(
    @Body() dto: RegisterDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.auth.register(dto, req, res);
  }
  @Post('email/verify') @HttpCode(200) verifyEmail(@Body() dto: TokenDto, @Req() req: Request) {
    return this.auth.verifyEmail(dto, req);
  }
  @Post('email/resend') @HttpCode(200) resendEmail(@Body() dto: EmailDto, @Req() req: Request) {
    return this.auth.resendEmail(dto, req);
  }
  @Post('login') @HttpCode(200) login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.auth.login(dto, req, res);
  }
  @Post('device/approve') @HttpCode(200) approveDevice(@Body() dto: TokenDto, @Req() req: Request) {
    return this.auth.approveDevice(dto, req);
  }
  @Post('device/resend') @HttpCode(200) resendDevice(@Body() dto: EmailDto, @Req() req: Request) {
    return this.auth.resendDevice(dto, req);
  }

  @Post('password/forgot')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Solicita recuperação de senha com resposta genérica sem revelar existência da conta',
  })
  forgotPassword(@Body() dto: EmailDto, @Req() req: Request) {
    return this.auth.forgotPassword(dto, req);
  }

  @Post('password/reset')
  @HttpCode(200)
  @ApiOperation({ summary: 'Redefine senha com token de recuperação e revoga sessões existentes' })
  resetPassword(@Body() dto: ResetPasswordDto, @Req() req: Request) {
    return this.auth.resetPassword(dto, req);
  }

  @Post('password/change')
  @HttpCode(200)
  @UseGuards(AccessTokenGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Altera senha autenticada exigindo senha atual e revoga todas as sessões',
  })
  changePassword(
    @Body() dto: ChangePasswordDto,
    @CurrentUser() user: { userId: string; sessionId: string; deviceId: string },
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.auth.changePassword(dto, user, req, res);
  }

  @Get('sessions')
  @UseGuards(AccessTokenGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lista sessões do usuário autenticado sem hashes, IPs ou segredos' })
  sessions(@CurrentUser() user: { userId: string; sessionId: string }) {
    return this.auth.listSessions(user);
  }

  @Delete('sessions/:sessionId')
  @HttpCode(200)
  @UseGuards(AccessTokenGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Revoga uma sessão própria de forma idempotente e segura contra IDOR' })
  revokeSession(
    @Param('sessionId', new ParseUUIDPipe({ version: '4' })) sessionId: string,
    @CurrentUser() user: { userId: string; sessionId: string },
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.auth.revokeSession(sessionId, user, req, res);
  }

  @Post('sessions/logout-all')
  @HttpCode(200)
  @UseGuards(AccessTokenGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Revoga todas as sessões do usuário e limpa cookies de refresh/CSRF' })
  logoutAll(
    @CurrentUser() user: { userId: string },
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.auth.logoutAll(user, req, res);
  }

  @Get('devices')
  @UseGuards(AccessTokenGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lista dispositivos do usuário autenticado sem tokenHash' })
  devices(@CurrentUser() user: { userId: string; deviceId: string }) {
    return this.auth.listDevices(user);
  }

  @Delete('devices/:deviceId')
  @HttpCode(200)
  @UseGuards(AccessTokenGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Revoga um dispositivo próprio, suas sessões e desafios pendentes' })
  revokeDevice(
    @Param('deviceId', new ParseUUIDPipe({ version: '4' })) deviceId: string,
    @CurrentUser() user: { userId: string; deviceId: string },
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.auth.revokeDevice(deviceId, user, req, res);
  }

  @Post('email/change/request')
  @HttpCode(200)
  @UseGuards(AccessTokenGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Solicita alteração segura de e-mail com confirmação dupla, TTL, maxAttempts e sem expor tokens',
  })
  @ApiResponse({
    status: 200,
    description: 'Confirmações essenciais enviadas para e-mail atual e novo.',
  })
  @ApiResponse({
    status: 503,
    description: 'EMAIL_DELIVERY_UNAVAILABLE quando um e-mail essencial não é entregue.',
  })
  requestEmailChange(
    @Body() dto: EmailChangeRequestDto,
    @CurrentUser() user: { userId: string; sessionId: string; deviceId: string },
    @Req() req: Request,
  ) {
    return this.auth.requestEmailChange(dto, user, req);
  }

  @Post('email/change/confirm')
  @HttpCode(200)
  @ApiOperation({
    summary:
      'Confirma um dos lados da alteração de e-mail; conclui apenas após dupla confirmação, revoga sessões e inicia hold',
  })
  @ApiResponse({
    status: 200,
    description: 'PENDING ou COMPLETED; respostas não expõem tokens, hashes ou peppers.',
  })
  @ApiResponse({
    status: 400,
    description: 'Token inválido, expirado, consumido, EMAIL_UNAVAILABLE ou maxAttempts excedido.',
  })
  confirmEmailChange(
    @Body() dto: EmailChangeConfirmDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.auth.confirmEmailChange(dto, req, res);
  }

  @Post('phone/request')
  @HttpCode(200)
  @UseGuards(AccessTokenGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Solicita verificação ou alteração de telefone por SMS com senha atual, cooldown e rate limit',
  })
  @ApiResponse({
    status: 200,
    description: 'Retorna challengeId e expiresAt sem retornar código SMS.',
  })
  @ApiResponse({ status: 429, description: 'RATE_LIMITED ou PHONE_RESEND_COOLDOWN.' })
  @ApiResponse({
    status: 503,
    description: 'SMS_DELIVERY_UNAVAILABLE quando SMS estiver desabilitado ou falhar.',
  })
  requestPhone(
    @Body() dto: PhoneRequestDto,
    @CurrentUser() user: { userId: string; sessionId: string; deviceId: string },
    @Req() req: Request,
  ) {
    return this.auth.requestPhone(dto, user, req);
  }

  @Post('phone/verify')
  @HttpCode(200)
  @UseGuards(AccessTokenGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Confirma telefone por SMS, aplica maxAttempts, revoga sessões, limpa refresh/CSRF e inicia hold de segurança',
  })
  @ApiResponse({
    status: 200,
    description: 'Telefone persistido em E.164; resposta sem telefone completo, código ou hash.',
  })
  @ApiResponse({
    status: 400,
    description: 'Código inválido/expirado/bloqueado, target incompatível ou PHONE_UNAVAILABLE.',
  })
  verifyPhone(
    @Body() dto: PhoneVerifyDto,
    @CurrentUser() user: { userId: string; sessionId: string; deviceId: string },
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.auth.verifyPhone(dto, user, req, res);
  }

  @Post('refresh') @HttpCode(200) @ApiCookieAuth() refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.auth.refresh(req, res);
  }
  @Post('logout') @HttpCode(200) @ApiCookieAuth() logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.auth.logout(req, res);
  }
  @Get('me') @UseGuards(AccessTokenGuard) @ApiBearerAuth() @ApiResponse({ status: 200 }) me(
    @CurrentUser() user: { userId: string },
  ) {
    return this.auth.me(user.userId);
  }
}
