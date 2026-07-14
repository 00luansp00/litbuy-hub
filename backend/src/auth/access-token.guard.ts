/* eslint-disable */
import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../database/prisma.service';
@Injectable()
export class AccessTokenGuard implements CanActivate {
  constructor(
    private jwt: JwtService,
    private config: ConfigService,
    private prisma: PrismaService,
  ) {}
  async canActivate(ctx: ExecutionContext) {
    const req = ctx.switchToHttp().getRequest();
    const h = req.headers.authorization;
    if (!h?.startsWith('Bearer '))
      throw new UnauthorizedException({ code: 'ACCESS_TOKEN_REQUIRED' });
    try {
      const p = await this.jwt.verifyAsync(h.slice(7), {
        secret: this.config.getOrThrow<any>('auth').accessSecret,
      });
      if (p.type !== 'access' || !p.sub || !p.sid) throw new Error('bad');
      const s = await this.prisma.session.findUnique({ where: { id: p.sid } });
      if (!s || s.userId !== p.sub || s.revokedAt || s.expiresAt < new Date())
        throw new Error('revoked');
      req.auth = { userId: p.sub, sessionId: p.sid };
      return true;
    } catch {
      throw new UnauthorizedException({ code: 'INVALID_ACCESS_TOKEN' });
    }
  }
}
