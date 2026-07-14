import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../database/prisma.service';
import type { AccessTokenPayload, AuthRuntimeConfig, AuthenticatedRequest } from './auth.types';

@Injectable()
export class AccessTokenGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer '))
      throw new UnauthorizedException({ code: 'ACCESS_TOKEN_REQUIRED' });
    try {
      const auth = this.config.getOrThrow<AuthRuntimeConfig>('auth');
      const payload = await this.jwt.verifyAsync<AccessTokenPayload>(header.slice(7), {
        secret: auth.accessSecret,
      });
      if (payload.type !== 'access' || !payload.sub || !payload.sid)
        throw new Error('invalid payload');
      const session = await this.prisma.session.findUnique({ where: { id: payload.sid } });
      if (
        !session ||
        session.userId !== payload.sub ||
        session.revokedAt ||
        session.expiresAt < new Date()
      )
        throw new Error('inactive session');
      req.auth = { userId: payload.sub, sessionId: payload.sid };
      return true;
    } catch {
      throw new UnauthorizedException({ code: 'INVALID_ACCESS_TOKEN' });
    }
  }
}
