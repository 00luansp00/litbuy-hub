import { Body, Controller, Get, HttpCode, Post, Req, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiCookieAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { EmailDto, LoginDto, RegisterDto, TokenDto } from './dto';
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
