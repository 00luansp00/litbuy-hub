import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PlatformRole } from '@prisma/client';
import type { AuthenticatedRequest } from './auth.types';
import { PLATFORM_ROLES_KEY } from './platform-roles';
import { PlatformRolesService } from './platform-roles.service';

@Injectable()
export class PlatformRolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly roles: PlatformRolesService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<PlatformRole[]>(PLATFORM_ROLES_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!required) return true;
    if (required.length === 0) throw new ForbiddenException({ code: 'INSUFFICIENT_ROLE' });
    const req = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    const userId = req.auth?.userId;
    if (!userId) throw new ForbiddenException({ code: 'INSUFFICIENT_ROLE' });
    try {
      if (await this.roles.userHasAnyRole(userId, required)) return true;
    } catch {
      throw new ForbiddenException({ code: 'INSUFFICIENT_ROLE' });
    }
    throw new ForbiddenException({ code: 'INSUFFICIENT_ROLE' });
  }
}
