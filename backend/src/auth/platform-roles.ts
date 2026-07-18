import { SetMetadata } from '@nestjs/common';
import { PlatformRole } from '@prisma/client';

export const PLATFORM_ROLES_KEY = 'platformRoles:any';

/** Requires the authenticated user to have at least one of the provided roles. */
export const RequireRoles = (...roles: PlatformRole[]) => SetMetadata(PLATFORM_ROLES_KEY, roles);

export const PLATFORM_ROLE_API_VALUES = ['buyer', 'seller', 'admin'] as const;
export type PlatformRoleApi = (typeof PLATFORM_ROLE_API_VALUES)[number];

const order: Record<PlatformRole, number> = {
  [PlatformRole.BUYER]: 0,
  [PlatformRole.SELLER]: 1,
  [PlatformRole.ADMIN]: 2,
};

const apiValue: Record<PlatformRole, PlatformRoleApi> = {
  [PlatformRole.BUYER]: 'buyer',
  [PlatformRole.SELLER]: 'seller',
  [PlatformRole.ADMIN]: 'admin',
};

export function toPlatformRoleApiValues(roles: PlatformRole[]): PlatformRoleApi[] {
  return [...new Set(roles)].sort((a, b) => order[a] - order[b]).map((role) => apiValue[role]);
}
