import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AuthRuntimeConfig, AuthenticatedRequest } from '../auth/auth.types';
import { hmacToken, safeEqual } from '../auth/auth.utils';
import { PrismaService } from '../database/prisma.service';
@Injectable()
export class CartCsrfGuard implements CanActivate {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}
  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const auth = this.config.getOrThrow<AuthRuntimeConfig>('auth');
    const cookie = request.cookies?.[auth.csrfCookieName] as string | undefined;
    const header = request.headers['x-csrf-token'];
    if (!cookie || typeof header !== 'string' || !safeEqual(cookie, header))
      throw new UnauthorizedException({ code: 'INVALID_CSRF' });
    const session = await this.prisma.session.findUnique({
      where: { id: request.auth!.sessionId },
    });
    if (!session || !safeEqual(hmacToken(cookie, auth.csrfPepper), session.csrfTokenHash))
      throw new UnauthorizedException({ code: 'INVALID_CSRF' });
    return true;
  }
}
